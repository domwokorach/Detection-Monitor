"""Watchlist hits: deduplicated analytics plus an authenticated live stream (Server-Sent Events)."""
import asyncio
import json
from typing import Literal
from fastapi import APIRouter, Depends, Query, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from .db import get_db
from .models import User
from .security import auth_scheme, current_user, verify_token
from .services import watchlist
from .register_api import _maker, _sse

router = APIRouter(prefix="/api/watchlist")


@router.get("/hits")
def watchlist_hits(range: Literal["1h", "24h", "7d", "30d"] = Query("24h"), db: Session = Depends(get_db),
                   _user: User = Depends(current_user)):
    return watchlist.build(db, range)


@router.get("/stream")
async def watchlist_stream(request: Request, db: Session = Depends(get_db), credentials=Depends(auth_scheme),
                           _user: User = Depends(current_user)):
    """Emits `changed` only when a real hit or alert status changes. The token is re-checked every tick."""
    maker, token = _maker(db), credentials.credentials
    db.close()

    def tick():
        with maker() as s:
            return None if verify_token(s, token) is None else watchlist.change_version(s)

    async def gen():
        last = await run_in_threadpool(tick)
        yield _sse("hello", {"version": last})
        beat, loop = 0.0, asyncio.get_running_loop()
        while not await request.is_disconnected():
            await asyncio.sleep(2)
            version = await run_in_threadpool(tick)
            if version is None:
                yield _sse("unauthorised", {})
                return
            if version != last:
                last = version
                yield _sse("changed", {"version": version})
            if loop.time() - beat >= 10:
                beat = loop.time()
                yield _sse("heartbeat", {})

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no", "Connection": "keep-alive"})
