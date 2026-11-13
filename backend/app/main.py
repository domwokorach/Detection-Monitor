"""Fraud monitoring API entry point."""
from contextlib import asynccontextmanager
from sqlalchemy import inspect, text
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .db import Base, engine, SessionLocal
from .seed import seed_demo
from . import models  # registers metadata
from .api import router
from .register_api import router as register_router
from .watchlist_api import router as watchlist_router


def ensure_account_la_code():
    """create_all never alters existing tables; add nullable columns for databases made before they existed."""
    wanted = {"accounts": [("la_code", "VARCHAR(9)"), ("address", "JSON")], "merchants": [("address", "JSON")],
              "alerts": [("opened_at", "TIMESTAMP WITH TIME ZONE"), ("closed_at", "TIMESTAMP WITH TIME ZONE"), ("confirmed_loss", "NUMERIC(18, 2)")]}
    tables = set(inspect(engine).get_table_names())
    for table, columns in wanted.items():
        if table not in tables:
            continue
        existing = {c["name"] for c in inspect(engine).get_columns(table)}
        for name, ddl in columns:
            if name not in existing:
                with engine.begin() as conn:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    # MVP convenience. Use versioned migrations for managed deployments.
    Base.metadata.create_all(bind=engine)
    ensure_account_la_code()
    from .services.register import backfill_alert_timestamps, purge_exports
    with SessionLocal() as db:
        backfill_alert_timestamps(db)
        purge_exports(db)
    import os
    if os.getenv("SEED_DEMO", "0") == "1":
        with SessionLocal() as db:
            seed_demo(db)
    yield


app = FastAPI(title="Sentinel | Transaction Monitoring API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=[settings.cors_origin],
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
                   expose_headers=["Content-Disposition", "X-Export-Generated-At", "X-Export-Rows", "X-Export-Filters"])
app.include_router(router)
app.include_router(register_router)
app.include_router(watchlist_router)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "fraud-monitor-api"}
