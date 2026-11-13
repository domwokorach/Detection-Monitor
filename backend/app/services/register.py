"""Investigation register: filtered/sorted queries, KPI summary, CSV export (streamed or background job) and live events.

An *investigation* is an alert and its case workflow (one alert per transaction, enforced by a unique constraint),
so a transaction's financial exposure can only ever be counted once.

Money definitions (GBP only; no FX rates are held, so other currencies are never converted or summed):
  * suspected exposure  = amount of an outgoing (DEBIT) GBP transaction whose investigation is not yet closed.
  * confirmed loss      = GBP amount an analyst recorded when closing the case as confirmed suspicious. Never inferred.
"""
import csv
import io
import json
import os
import tempfile
import threading
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import and_, case, func, or_, select, update
from sqlalchemy.orm import Session, sessionmaker

from ..config import settings
from ..models import Account, Alert, AuditEvent, ExportJob, Transaction, TransactionContext, User, new_id, utcnow
from .audit import append_audit
from .investigation import aware, can_view_pii, mask_ip

LONDON = ZoneInfo("Europe/London")
STATUSES = ("OPEN", "IN_REVIEW", "ESCALATED", "CLOSED")
SEVERITIES = ("moderate", "elevated", "high", "critical")
HIGH_RISK = 70
MAX_IDS = 200
CSV_COLUMNS = [
    "investigation_id", "transaction_id", "customer_reference", "merchant_name", "transaction_amount_gbp",
    "suspected_exposure_gbp", "confirmed_loss_gbp", "risk_score", "risk_level", "ip_address", "city", "county",
    "country", "transaction_time_utc", "detected_time_utc", "opened_time_utc", "last_updated_utc",
    "assigned_analyst", "investigation_status",
]


def severity(score: int) -> str:
    """Same bands as the dashboard's alert risk levels."""
    return "critical" if score >= 85 else "high" if score >= 70 else "elevated" if score >= 60 else "moderate"


# --------------------------------------------------------------------------------------------- permissions
def can_export(user: User) -> bool:
    return user.role in {r.strip() for r in settings.export_roles.split(",") if r.strip()}


# ------------------------------------------------------------------------------------------------ filters
@dataclass
class Filters:
    start_date: date | None = None
    end_date: date | None = None
    status: list[str] = field(default_factory=list)
    severity: list[str] = field(default_factory=list)
    risk_min: int | None = None
    risk_max: int | None = None
    analyst_id: str | None = None
    city: str | None = None
    county: str | None = None
    q: str | None = None
    ids: list[str] = field(default_factory=list)

    def describe(self) -> dict:
        """Only the filters actually applied, JSON-safe, for audit and response headers."""
        out: dict = {}
        for key, value in self.__dict__.items():
            if value in (None, "", []):
                continue
            out[key] = value.isoformat() if isinstance(value, date) else value
        if "ids" in out:
            out["ids"] = len(out["ids"])  # count only: ids themselves are not filter criteria worth logging
        return out


def _london_day_start(d: date) -> datetime:
    return datetime(d.year, d.month, d.day, tzinfo=LONDON).astimezone(timezone.utc)


def _base():
    return (select(Alert, Transaction, Account, TransactionContext, User)
            .join(Transaction, Transaction.id == Alert.transaction_id)
            .join(Account, Account.id == Transaction.account_id)
            .outerjoin(TransactionContext, TransactionContext.transaction_id == Transaction.id)
            .outerjoin(User, User.id == Alert.assigned_to))


def _like(value: str) -> str:
    return "%" + value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


def _where(stmt, f: Filters):
    if f.start_date:
        stmt = stmt.where(Alert.created_at >= _london_day_start(f.start_date))
    if f.end_date:  # inclusive calendar day in UK time
        stmt = stmt.where(Alert.created_at < _london_day_start(f.end_date + timedelta(days=1)))
    if f.status:
        stmt = stmt.where(Alert.status.in_(f.status))
    if f.severity:
        bands = {"critical": Alert.risk_score >= 85, "high": and_(Alert.risk_score >= 70, Alert.risk_score < 85),
                 "elevated": and_(Alert.risk_score >= 60, Alert.risk_score < 70), "moderate": Alert.risk_score < 60}
        stmt = stmt.where(or_(*[bands[s] for s in f.severity]))
    if f.risk_min is not None:
        stmt = stmt.where(Alert.risk_score >= f.risk_min)
    if f.risk_max is not None:
        stmt = stmt.where(Alert.risk_score <= f.risk_max)
    if f.analyst_id:
        stmt = stmt.where(Alert.assigned_to == f.analyst_id)
    if f.city:
        stmt = stmt.where(func.lower(TransactionContext.geo_city) == f.city.strip().lower())
    if f.county:
        stmt = stmt.where(func.lower(TransactionContext.geo_county) == f.county.strip().lower())
    if f.q and f.q.strip():
        like = _like(f.q.strip())
        stmt = stmt.where(or_(*[c.ilike(like, escape="\\") for c in (
            Alert.id, Transaction.external_id, Transaction.counterparty, Account.account_number_masked,
            TransactionContext.geo_city, TransactionContext.geo_county)]))
    if f.ids:
        stmt = stmt.where(Alert.id.in_(f.ids))
    return stmt


SORTS = {
    "updated": Alert.updated_at, "detected": Alert.created_at, "opened": Alert.opened_at, "risk": Alert.risk_score,
    "amount": Transaction.amount, "transaction_time": Transaction.occurred_at, "status": Alert.status,
    "merchant": func.lower(Transaction.counterparty), "analyst": func.lower(User.display_name),
}


def _ordered(stmt, sort: str, desc: bool):
    col = SORTS.get(sort, Alert.updated_at)
    return stmt.order_by(col.desc() if desc else col.asc(), Alert.id)


# --------------------------------------------------------------------------------------------------- rows
def _iso(ts: datetime | None) -> str | None:
    return aware(ts).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") if ts else None


def _gbp(value: Decimal | None) -> str | None:
    return None if value is None else f"{Decimal(value):.2f}"


def exposure(alert: Alert, tx: Transaction) -> Decimal | None:
    if alert.status == "CLOSED" or tx.currency != "GBP" or tx.direction != "DEBIT":
        return None
    return tx.amount


def to_row(alert: Alert, tx: Transaction, account: Account, ctx: TransactionContext | None, assignee: User | None,
           reveal: bool, seen_tx: set[str]) -> dict:
    """One register row. `seen_tx` guarantees a transaction's exposure appears once even if data ever allowed two alerts."""
    exp = None if tx.id in seen_tx else exposure(alert, tx)
    seen_tx.add(tx.id)
    ip = None
    if ctx and ctx.source_ip:
        ip = ctx.source_ip if reveal else mask_ip(ctx.source_ip)
    return {
        "id": alert.id, "case_ref": f"INV-{alert.id.replace('-', '')[-5:].upper()}",
        "transaction_id": tx.external_id, "customer_reference": account.account_number_masked,
        "merchant_name": tx.counterparty, "amount": f"{tx.amount:.2f}", "currency": tx.currency,
        "suspected_exposure": _gbp(exp), "confirmed_loss": _gbp(alert.confirmed_loss),
        "risk_score": alert.risk_score, "severity": severity(alert.risk_score),
        "ip_address": ip, "ip_masked": not reveal,
        "city": ctx.geo_city if ctx else None, "county": ctx.geo_county if ctx else None,
        "country": ctx.geo_country if ctx else None, "la_code": (ctx.geo_la_code if ctx else None) or account.la_code,
        "transaction_time": _iso(tx.occurred_at), "detected_at": _iso(alert.created_at), "opened_at": _iso(alert.opened_at),
        "last_updated": _iso(alert.updated_at),
        "assigned_to": {"id": assignee.id, "display_name": assignee.display_name} if assignee else None,
        "status": alert.status,
    }


def list_rows(db: Session, f: Filters, user: User, sort: str, desc: bool, offset: int, limit: int) -> tuple[list[dict], int]:
    total = count_rows(db, f)
    rows = db.execute(_ordered(_where(_base(), f), sort, desc).offset(offset).limit(limit)).all()
    reveal, seen = can_view_pii(user), set()
    return [to_row(*r, reveal, seen) for r in rows], total


def analyst_facets(db: Session) -> list[dict]:
    rows = db.execute(select(User.id, User.display_name).join(Alert, Alert.assigned_to == User.id).distinct()
                      .order_by(User.display_name)).all()
    return [{"id": i, "display_name": n} for i, n in rows]


def change_cursor(db: Session) -> int:
    return db.scalar(select(func.max(AuditEvent.seq))) or 0


# ------------------------------------------------------------------------------------------------ summary
def summary(db: Session) -> dict:
    """Counters over every investigation (not the table's filters). All figures are read from the database."""
    gbp_debit = and_(Transaction.currency == "GBP", Transaction.direction == "DEBIT")
    active = Alert.status != "CLOSED"
    row = db.execute(
        select(
            func.count(Alert.id),
            func.sum(case((active, 1), else_=0)),
            func.sum(case((and_(active, Alert.risk_score >= HIGH_RISK), 1), else_=0)),
            func.sum(case((Alert.status == "ESCALATED", 1), else_=0)),
            func.sum(case((and_(active, gbp_debit), Transaction.amount), else_=0)),
            func.sum(case((and_(active, ~gbp_debit), 1), else_=0)),
            func.sum(case((and_(Alert.status == "CLOSED", Alert.disposition == "SUSPICIOUS"), Alert.confirmed_loss), else_=0)),
        ).select_from(Alert).join(Transaction, Transaction.id == Alert.transaction_id)).one()
    total, active_n, high, escalated, exp, excluded, loss = row
    closed = db.execute(select(Alert.created_at, Alert.closed_at).where(Alert.status == "CLOSED", Alert.closed_at.is_not(None))).all()
    secs = [(aware(c) - aware(a)).total_seconds() for a, c in closed]
    return {
        "total": int(total or 0), "active": int(active_n or 0), "high_risk": int(high or 0), "escalated": int(escalated or 0),
        "suspected_exposure_gbp": f"{Decimal(str(exp or 0)):.2f}", "confirmed_loss_gbp": f"{Decimal(str(loss or 0)):.2f}",
        "exposure_excluded_cases": int(excluded or 0),
        "avg_resolution_seconds": round(sum(secs) / len(secs), 1) if secs else None, "resolved_count": len(secs),
        "as_of": _iso(utcnow()), "cursor": change_cursor(db),
    }


# ----------------------------------------------------------------------------------------------- live events
def classify(event: AuditEvent) -> str | None:
    """Map a real audit entry to the investigation change it represents; None if it is not one."""
    after, before = event.after or {}, event.before or {}
    if event.action == "ALERT_CREATED":
        return "created"
    if event.action != "ALERT_REVIEWED":
        return None
    if after.get("status") != before.get("status"):
        return {"ESCALATED": "escalated", "CLOSED": "closed", "IN_REVIEW": "opened"}.get(after.get("status"), "updated")
    if after.get("assigned_to") != before.get("assigned_to"):
        return "assigned"
    if after.get("review_note") != before.get("review_note"):
        return "note"
    return "updated"


def events_after(db: Session, cursor: int, limit: int = 100) -> list[dict]:
    rows = db.scalars(select(AuditEvent).where(AuditEvent.seq > cursor, AuditEvent.action.in_(("ALERT_CREATED", "ALERT_REVIEWED")))
                      .order_by(AuditEvent.seq).limit(limit)).all()
    return [{"seq": e.seq, "kind": classify(e), "alert_id": e.entity_id, "actor": e.actor, "at": _iso(e.created_at)} for e in rows]


# -------------------------------------------------------------------------------------------------- CSV
def safe_cell(value):
    """Neutralise spreadsheet formula injection: text starting with = + - @ (or tab/CR) is prefixed with an apostrophe."""
    if value is None:
        return ""
    if isinstance(value, str) and value.strip() and (value[0] in "\t\r" or value.lstrip()[0] in "=+-@"):
        return "'" + value
    return value


def csv_row(row: dict) -> list:
    t = lambda k: row[k]  # noqa: E731
    gbp = t("amount") if row["currency"] == "GBP" else None
    return [safe_cell(v) for v in [
        row["id"], t("transaction_id"), t("customer_reference"), t("merchant_name"), gbp,
        t("suspected_exposure"), t("confirmed_loss"), t("risk_score"), t("severity"), t("ip_address"), t("city"), t("county"),
        t("country"), t("transaction_time"), t("detected_at"), t("opened_at"), t("last_updated"),
        row["assigned_to"]["display_name"] if row["assigned_to"] else None, t("status")]]


def render_chunk(rows: list[dict], header: bool = False) -> str:
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\r\n")
    if header:
        w.writerow(CSV_COLUMNS)
    for r in rows:
        w.writerow(csv_row(r))
    return buf.getvalue()


def export_filename(now: datetime | None = None) -> str:
    return f"detection-monitor-investigations-{(now or utcnow()).astimezone(LONDON):%Y-%m-%d}.csv"


def begin_snapshot(db: Session) -> None:
    """Start a consistent point-in-time read. PostgreSQL REPEATABLE READ gives every query the same snapshot."""
    db.commit()  # end the implicit transaction opened by authentication
    if db.get_bind().dialect.name == "postgresql":
        db.connection(execution_options={"isolation_level": "REPEATABLE READ"})


def snapshot_rows(db: Session, f: Filters, user: User):
    """Yield register rows (export order: newest detection first) from the current snapshot in batches."""
    reveal, seen, offset = can_view_pii(user), set(), 0
    while True:
        rows = db.execute(_ordered(_where(_base(), f), "detected", True).offset(offset).limit(500)).all()
        if not rows:
            return
        for r in rows:
            yield to_row(*r, reveal, seen)
        offset += len(rows)


def count_rows(db: Session, f: Filters) -> int:
    return db.scalar(_where(select(func.count(Alert.id)).select_from(Alert)
                            .join(Transaction, Transaction.id == Alert.transaction_id)
                            .join(Account, Account.id == Transaction.account_id)
                            .outerjoin(TransactionContext, TransactionContext.transaction_id == Transaction.id)
                            .outerjoin(User, User.id == Alert.assigned_to), f)) or 0


def backfill_alert_timestamps(db: Session) -> None:
    """Fill opened_at/closed_at for alerts that pre-date those columns, using only the recorded audit trail.

    Untouched alerts stay null. A closed case with no recorded close event falls back to its last update, which is
    exact because closed cases are immutable. updated_at is written back unchanged so history is not disturbed.
    """
    pending = db.scalars(select(Alert).where(or_(and_(Alert.opened_at.is_(None), Alert.status != "OPEN"),
                                                  and_(Alert.closed_at.is_(None), Alert.status == "CLOSED")))).all()
    for a in pending:
        events = db.scalars(select(AuditEvent).where(AuditEvent.entity_id == a.id, AuditEvent.action == "ALERT_REVIEWED")
                            .order_by(AuditEvent.seq)).all()
        opened, closed = a.opened_at, a.closed_at
        if opened is None:
            opened = next((e.created_at for e in events if (e.after or {}).get("status") in ("IN_REVIEW", "ESCALATED")
                           or (e.after or {}).get("assigned_to")), None)
        if a.status == "CLOSED" and closed is None:
            closed = next((e.created_at for e in events if (e.after or {}).get("status") == "CLOSED"), a.updated_at)
        db.execute(update(Alert).where(Alert.id == a.id).values(opened_at=opened, closed_at=closed, updated_at=a.updated_at))
    db.commit()


# ------------------------------------------------------------------------------------- background export
_lock = threading.Lock()


def export_dir() -> str:
    path = settings.export_dir or os.path.join(tempfile.gettempdir(), "detection-monitor-exports")
    os.makedirs(path, mode=0o700, exist_ok=True)
    os.chmod(path, 0o700)
    return path


def secure_delete(path: str | None) -> None:
    """Best-effort overwrite then unlink. (SSD/COW filesystems cannot guarantee erasure; the directory is private.)"""
    if not path or not os.path.exists(path):
        return
    try:
        size = os.path.getsize(path)
        with open(path, "r+b") as fh:
            fh.write(b"\0" * size)
            fh.flush()
            os.fsync(fh.fileno())
    except OSError:
        pass
    try:
        os.remove(path)
    except OSError:
        pass


def purge_exports(db: Session) -> None:
    """Retention: delete files for expired or finished jobs, and any orphaned file no job references."""
    now = utcnow()
    for job in db.scalars(select(ExportJob).where(ExportJob.file_path.is_not(None))):
        if job.status in ("DOWNLOADED", "EXPIRED", "FAILED") or (job.expires_at and aware(job.expires_at) < now):
            secure_delete(job.file_path)
            job.file_path = None
            if job.status in ("READY", "RUNNING", "QUEUED"):
                job.status = "EXPIRED"
    live = {p for p in db.scalars(select(ExportJob.file_path).where(ExportJob.file_path.is_not(None)))}
    directory = export_dir()
    for name in os.listdir(directory):
        full = os.path.join(directory, name)
        if full not in live and now.timestamp() - os.path.getmtime(full) > settings.export_ttl_seconds:
            secure_delete(full)
    db.commit()


def start_job(db: Session, user: User, f: Filters, scope: str, total: int) -> ExportJob:
    job = ExportJob(id=new_id(), user_id=user.id, scope=scope, filters=f.describe(), total=total, status="QUEUED")
    db.add(job)
    append_audit(db, actor=user.email, action="INVESTIGATIONS_EXPORT_REQUESTED", entity_type="investigation_export",
                 entity_id=job.id, after={"scope": scope, "filters": job.filters, "rows_estimated": total, "delivery": "background_job"})
    db.commit()
    maker = sessionmaker(bind=db.get_bind(), autoflush=False, expire_on_commit=False)
    threading.Thread(target=run_job, args=(maker, job.id, f, user.id), daemon=True, name=f"export-{job.id}").start()
    return job


def run_job(maker: sessionmaker, job_id: str, f: Filters, user_id: str) -> None:
    with maker() as db:
        job, user = db.get(ExportJob, job_id), db.get(User, user_id)
        path = None
        try:
            job.status = "RUNNING"
            db.commit()
            begin_snapshot(db)  # one consistent snapshot for the whole file
            fd, path = tempfile.mkstemp(prefix="inv-", suffix=".csv", dir=export_dir())  # mode 0600, unguessable name
            generated = utcnow()
            n = 0
            with os.fdopen(fd, "w", encoding="utf-8", newline="") as fh:
                fh.write(render_chunk([], header=True))
                batch: list[dict] = []
                for row in snapshot_rows(db, f, user):
                    batch.append(row)
                    n += 1
                    if len(batch) >= 500:
                        fh.write(render_chunk(batch))
                        batch.clear()
                        with maker() as progress:  # separate session so progress is visible during the snapshot
                            progress.get(ExportJob, job_id).processed = n
                            progress.commit()
                fh.write(render_chunk(batch))
            db.rollback()  # end snapshot before writing audit (avoids serialisation conflicts on the audit head)
            job = db.get(ExportJob, job_id)
            job.status, job.processed, job.total = "READY", n, n
            job.file_path, job.filename = path, export_filename(generated)
            job.finished_at = utcnow()
            job.expires_at = job.finished_at + timedelta(seconds=settings.export_ttl_seconds)
            append_audit(db, actor=user.email, action="INVESTIGATIONS_EXPORTED", entity_type="investigation_export", entity_id=job.id,
                         after={"scope": job.scope, "filters": job.filters, "row_count": n, "generated_at": _iso(generated),
                                "pii_masked": not can_view_pii(user), "delivery": "background_job"})
            db.commit()
        except Exception as exc:  # noqa: BLE001 - record any failure on the job; never leave a partial file
            db.rollback()
            secure_delete(path)
            job = db.get(ExportJob, job_id)
            job.status, job.file_path, job.error = "FAILED", None, type(exc).__name__
            job.finished_at = utcnow()
            db.commit()
