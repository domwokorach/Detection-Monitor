"""Investigation register API: list, KPI summary, live event stream and audited CSV export."""
import asyncio
import json
import os
from datetime import date, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.orm import Session, sessionmaker
from starlette.background import BackgroundTask

from .config import settings
from .db import get_db
from .models import ExportJob, User, new_id, utcnow
from .security import auth_scheme, current_user, verify_token
from .services import register
from .services.audit import append_audit
from .services.investigation import aware, can_view_pii

router = APIRouter(prefix="/api/investigations")


def _csv_list(values: list[str]) -> list[str]:
    return [p.strip() for v in values for p in v.split(",") if p.strip()]


def investigation_filters(
    start_date: date | None = None, end_date: date | None = None,
    status: list[str] = Query(default=[]), severity: list[str] = Query(default=[]),
    risk_min: int | None = Query(None, ge=0, le=100), risk_max: int | None = Query(None, ge=0, le=100),
    analyst_id: str | None = Query(None, max_length=36), city: str | None = Query(None, max_length=120),
    county: str | None = Query(None, max_length=120), q: str | None = Query(None, max_length=100),
    ids: list[str] = Query(default=[]),
) -> register.Filters:
    statuses, severities, id_list = _csv_list(status), _csv_list(severity), _csv_list(ids)
    if any(s not in register.STATUSES for s in statuses):
        raise HTTPException(422, f"status must be one of {', '.join(register.STATUSES)}")
    if any(s not in register.SEVERITIES for s in severities):
        raise HTTPException(422, f"severity must be one of {', '.join(register.SEVERITIES)}")
    if start_date and end_date and end_date < start_date:
        raise HTTPException(422, "end_date must not be before start_date")
    if risk_min is not None and risk_max is not None and risk_max < risk_min:
        raise HTTPException(422, "risk_max must not be below risk_min")
    if len(id_list) > register.MAX_IDS:
        raise HTTPException(422, f"At most {register.MAX_IDS} investigations can be selected per export")
    return register.Filters(start_date, end_date, statuses, severities, risk_min, risk_max, analyst_id, city, county, q, id_list)


def _maker(db: Session) -> sessionmaker:
    return sessionmaker(bind=db.get_bind(), autoflush=False, expire_on_commit=False)


@router.get("")
def list_investigations(f: register.Filters = Depends(investigation_filters),
                        sort: str = Query("updated"), direction: Literal["asc", "desc"] = "desc",
                        page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100),
                        db: Session = Depends(get_db), user: User = Depends(current_user)):
    if sort not in register.SORTS:
        raise HTTPException(422, f"sort must be one of {', '.join(register.SORTS)}")
    items, total = register.list_rows(db, f, user, sort, direction == "desc", (page - 1) * page_size, page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size, "as_of": register._iso(utcnow()),
            "cursor": register.change_cursor(db), "analysts": register.analyst_facets(db), "pii_masked": not can_view_pii(user)}


@router.get("/summary")
def investigations_summary(db: Session = Depends(get_db), _user: User = Depends(current_user)):
    return register.summary(db)


# ------------------------------------------------------------------------------------- live updates (SSE)
def _sse(event: str, data: dict, event_id: int | None = None) -> str:
    return (f"id: {event_id}\n" if event_id is not None else "") + f"event: {event}\ndata: {json.dumps(data, separators=(',', ':'))}\n\n"


@router.get("/stream")
async def investigations_stream(request: Request, after: int | None = Query(None, ge=0), db: Session = Depends(get_db),
                                credentials=Depends(auth_scheme), _user: User = Depends(current_user)):
    """Server-Sent Events fed only by real audit-log entries. Authenticated with the Bearer token; the token is
    re-checked every tick so signing out (revocation) or expiry ends the stream."""
    maker, token = _maker(db), credentials.credentials
    db.close()  # do not hold a pooled connection for the life of the stream

    def start():
        with maker() as s:
            return register.change_cursor(s)

    def tick(cursor: int):
        with maker() as s:
            if verify_token(s, token) is None:
                return None
            return register.events_after(s, cursor)

    async def gen():
        cursor = after if after is not None else await run_in_threadpool(start)
        yield _sse("hello", {"cursor": cursor, "at": register._iso(utcnow())})
        last_beat = 0.0
        loop = asyncio.get_running_loop()
        while not await request.is_disconnected():
            await asyncio.sleep(2)
            events = await run_in_threadpool(tick, cursor)
            if events is None:
                yield _sse("unauthorised", {})
                return
            for e in events:
                cursor = e["seq"]
                yield _sse("investigation", e, e["seq"])
            if loop.time() - last_beat >= 10:
                last_beat = loop.time()
                yield _sse("heartbeat", {"at": register._iso(utcnow()), "cursor": cursor})

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no", "Connection": "keep-alive"})


# ------------------------------------------------------------------------------------------- CSV export
def _export_headers(filename: str, generated: str, rows: int, filters: dict) -> dict:
    return {"Content-Disposition": f'attachment; filename="{filename}"', "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff", "X-Export-Generated-At": generated, "X-Export-Rows": str(rows),
            "X-Export-Filters": json.dumps(filters, separators=(",", ":"), ensure_ascii=True)}


@router.get("/export.csv")
def export_csv(scope: Literal["filtered", "page", "selected", "all"] = "filtered",
               f: register.Filters = Depends(investigation_filters),
               db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Point-in-time CSV built server-side from a consistent database snapshot, audited before delivery.

    scope=filtered uses the filters; page/selected use only `ids`; all ignores every filter. Exports larger than
    EXPORT_ASYNC_THRESHOLD return 202 with a background job to poll and download.
    """
    if not register.can_export(user):
        append_audit(db, actor=user.email, action="INVESTIGATIONS_EXPORT_DENIED", entity_type="investigation_export",
                     entity_id=new_id(), after={"scope": scope, "role": user.role})
        db.commit()
        raise HTTPException(403, "Your role is not permitted to export investigations")
    if scope in ("page", "selected"):
        if not f.ids:
            raise HTTPException(422, f"scope={scope} requires at least one investigation id")
        f = register.Filters(ids=f.ids)
    elif scope == "all":
        f = register.Filters()
    else:
        f.ids = []

    register.begin_snapshot(db)
    total = register.count_rows(db, f)
    if total > settings.export_async_threshold:
        db.rollback()
        register.purge_exports(db)
        job = register.start_job(db, user, f, scope, total)
        return JSONResponse(status_code=202, content={"job_id": job.id, "status": job.status, "total": total,
                                                      "status_url": f"/api/investigations/exports/{job.id}"})
    rows = list(register.snapshot_rows(db, f, user))
    generated = register._iso(utcnow())
    db.rollback()  # close the snapshot before writing the audit entry
    filename, export_id, applied = register.export_filename(), new_id(), f.describe()
    append_audit(db, actor=user.email, action="INVESTIGATIONS_EXPORTED", entity_type="investigation_export", entity_id=export_id,
                 after={"scope": scope, "filters": applied, "row_count": len(rows), "generated_at": generated,
                        "pii_masked": not can_view_pii(user), "delivery": "stream"})
    db.commit()  # fail closed: no file is released unless the audit entry was recorded

    def body():
        yield register.render_chunk([], header=True).encode("utf-8")
        for i in range(0, len(rows), 500):
            yield register.render_chunk(rows[i:i + 500]).encode("utf-8")

    return StreamingResponse(body(), media_type="text/csv; charset=utf-8",
                             headers=_export_headers(filename, generated, len(rows), {"scope": scope, **applied}))


def _owned_job(db: Session, job_id: str, user: User) -> ExportJob:
    job = db.get(ExportJob, job_id)
    if not job or job.user_id != user.id:  # 404, not 403: do not reveal other users' job ids
        raise HTTPException(404, "Export not found")
    return job


@router.get("/exports/{job_id}")
def export_status(job_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    register.purge_exports(db)
    job = _owned_job(db, job_id, user)
    return {"job_id": job.id, "status": job.status, "processed": job.processed, "total": job.total, "error": job.error,
            "expires_at": register._iso(job.expires_at), "download_url": f"/api/investigations/exports/{job.id}/download" if job.status == "READY" else None}


@router.get("/exports/{job_id}/download")
def export_download(job_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Single-use, owner-only download. The file is securely deleted once streamed."""
    job = _owned_job(db, job_id, user)
    if job.status != "READY" or not job.file_path or not os.path.exists(job.file_path):
        raise HTTPException(410 if job.status in ("DOWNLOADED", "EXPIRED") else 409, f"Export is {job.status.lower()}")
    if job.expires_at and aware(job.expires_at) < utcnow():
        register.purge_exports(db)
        raise HTTPException(410, "Export link has expired")
    path, filename, rows = job.file_path, job.filename, job.processed
    job.status = "DOWNLOADED"
    append_audit(db, actor=user.email, action="INVESTIGATIONS_EXPORT_DOWNLOADED", entity_type="investigation_export",
                 entity_id=job.id, after={"row_count": rows, "filename": filename})
    db.commit()

    def chunks():
        with open(path, "rb") as fh:
            while block := fh.read(65536):
                yield block

    return StreamingResponse(chunks(), media_type="text/csv; charset=utf-8",
                             headers=_export_headers(filename, register._iso(job.finished_at), rows, {"job": job.id}),
                             background=BackgroundTask(register.secure_delete, path))
