"""REST endpoints for banking ingestion and analyst case management."""
import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.security import HTTPAuthorizationCredentials

from .db import get_db
from .models import User, Account, Transaction, RiskRule, RuleMatch, Alert, OutboxEvent, AuditEvent, Merchant, TransactionContext, utcnow
from .schemas import (
    LoginIn, UserOut, AccountOut, TransactionIn, TransactionOut, TransactionDetail,
    AlertOut, AlertDetail, AlertReview, RuleIn, RuleUpdate, RuleOut, AuditOut, MatchOut,
    MerchantIn, MerchantOut, BrandSearchOut,
)
from .security import current_user, admin_user, issue_token, verify_password, revoke_token, auth_scheme
from .services.rules import validate_config, RuleConfigurationError
from .services.audit import append_audit, verify_chain
from .services import truelayer
from .services.brand_search import BrandSearchError, BrandSearchService, clean_domain, get_brand_search
from .services.merchants import normalize_name
from .services import investigation as investigation_service

router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)


def notify_screening() -> None:
    """Best-effort Redis wakeup. The Postgres outbox is the durable queue."""
    from .config import settings
    if not settings.notify_redis:
        return
    try:
        import redis
        client = redis.Redis.from_url(settings.redis_url, socket_connect_timeout=0.4, socket_timeout=0.4)
        client.lpush("fraud:screening:wakeup", "new-event")
        client.close()
    except Exception as exc:
        logger.warning("Redis notification failed; worker will poll outbox: %s", exc)


def tx_immutable_fields(tx: Transaction) -> dict:
    timestamp = tx.occurred_at
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
    return {"account_id": tx.account_id, "amount": tx.amount,
            "currency": tx.currency, "direction": tx.direction,
            "counterparty": tx.counterparty, "country": tx.country,
            "occurred_at": timestamp.astimezone(timezone.utc)}


def request_immutable_fields(payload: TransactionIn) -> dict:
    return payload.model_dump(exclude={"external_id", "context"})


@router.post("/auth/login")
def login(payload: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email.lower().strip()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    append_audit(db, actor=user.email, action="LOGIN", entity_type="user", entity_id=user.id)
    db.commit()
    return {"access_token": issue_token(user), "token_type": "bearer", "user": UserOut.model_validate(user)}


@router.post("/auth/logout", status_code=204)
def logout(user: User = Depends(current_user), credentials: HTTPAuthorizationCredentials = Depends(auth_scheme),
           db: Session = Depends(get_db)):
    revoke_token(db, credentials.credentials)
    append_audit(db, actor=user.email, action="LOGOUT", entity_type="user", entity_id=user.id)
    db.commit()
    return Response(status_code=204)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user


@router.get("/accounts", response_model=list[AccountOut])
def accounts(db: Session = Depends(get_db), _user: User = Depends(current_user)):
    return db.scalars(select(Account).order_by(Account.holder_name)).all()


@router.post("/transactions", response_model=TransactionOut, status_code=201)
def ingest_transaction(payload: TransactionIn, response: Response, db: Session = Depends(get_db),
                       user: User = Depends(current_user)):
    """External IDs are idempotency keys. Conflicting duplicate payloads return 409."""
    existing = db.scalar(select(Transaction).where(Transaction.external_id == payload.external_id))
    if existing:
        if tx_immutable_fields(existing) != request_immutable_fields(payload):
            raise HTTPException(status_code=409, detail="external_id already used with different transaction data")
        response.status_code = 200
        return existing
    if not db.get(Account, payload.account_id):
        raise HTTPException(status_code=404, detail="Account not found")
    tx = Transaction(**payload.model_dump(exclude={"context"}))
    db.add(tx)
    try:
        db.flush()
        if payload.context:
            db.add(TransactionContext(transaction_id=tx.id, **payload.context.model_dump()))
        db.add(OutboxEvent(event_type="TRANSACTION_RECEIVED", aggregate_id=tx.id,
                           payload={"external_id": tx.external_id}))
        append_audit(db, actor=user.email, action="TRANSACTION_INGESTED",
                     entity_type="transaction", entity_id=tx.id,
                     after={"external_id": tx.external_id, "account_id": tx.account_id,
                            "amount": str(tx.amount), "currency": tx.currency})
        db.commit()
    except IntegrityError:
        db.rollback()
        raced = db.scalar(select(Transaction).where(Transaction.external_id == payload.external_id))
        if raced and tx_immutable_fields(raced) == request_immutable_fields(payload):
            response.status_code = 200
            return raced
        raise HTTPException(status_code=409, detail="Duplicate external ID or conflicting transaction")
    db.refresh(tx)
    notify_screening()
    return tx


@router.get("/transactions", response_model=list[TransactionOut])
def list_transactions(db: Session = Depends(get_db), _user: User = Depends(current_user),
                      status: str | None = None, limit: int = Query(100, ge=1, le=500),
                      offset: int = Query(0, ge=0)):
    stmt = select(Transaction)
    if status:
        stmt = stmt.where(Transaction.screening_status == status)
    return db.scalars(stmt.order_by(Transaction.received_at.desc(), Transaction.id.desc())
                      .offset(offset).limit(limit)).all()


@router.get("/transactions/{transaction_id}", response_model=TransactionDetail)
def transaction_detail(transaction_id: str, db: Session = Depends(get_db),
                       _user: User = Depends(current_user)):
    tx = db.scalar(select(Transaction).options(selectinload(Transaction.matches)).where(Transaction.id == transaction_id))
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return tx


@router.get("/overview")
def overview(db: Session = Depends(get_db), _user: User = Depends(current_user)):
    transactions = db.scalar(select(func.count(Transaction.id))) or 0
    screened = db.scalar(select(func.count(Transaction.id)).where(Transaction.screening_status == "SCREENED")) or 0
    flagged = db.scalar(select(func.count(Alert.id))) or 0
    open_alerts = db.scalar(select(func.count(Alert.id)).where(Alert.status != "CLOSED")) or 0
    high_priority = db.scalar(select(func.count(Alert.id)).where(Alert.status != "CLOSED", Alert.priority == "HIGH")) or 0
    pending = db.scalar(select(func.count(OutboxEvent.id)).where(OutboxEvent.processed_at.is_(None))) or 0
    return {"transactions": transactions, "screened": screened, "flagged": flagged,
            "open_alerts": open_alerts, "high_priority": high_priority, "pending_jobs": pending,
            "alert_rate": round(flagged * 100 / screened, 1) if screened else 0}


@router.get("/analytics/daily")
def daily_analytics(db: Session = Depends(get_db), _user: User = Depends(current_user),
                    days: int = Query(7, ge=1, le=30)):
    # Portable aggregation for Postgres + SQLite tests. Limited to sample/MVP data scale.
    today = datetime.now(timezone.utc).date()
    first = today - timedelta(days=days - 1)
    rows = {str(first + timedelta(days=i)): {"date": str(first + timedelta(days=i)), "transactions": 0, "flagged": 0}
            for i in range(days)}
    txs = db.scalars(select(Transaction).where(Transaction.occurred_at >= datetime.combine(first, datetime.min.time(), tzinfo=timezone.utc))).all()
    alert_txids = set(db.scalars(select(Alert.transaction_id)).all())
    for tx in txs:
        key = str(tx.occurred_at.date())
        if key in rows:
            rows[key]["transactions"] += 1
            rows[key]["flagged"] += int(tx.id in alert_txids)
    return list(rows.values())


RISK_MAP_THRESHOLD = 60


@router.get("/risk-map")
def risk_map(db: Session = Depends(get_db), _user: User = Depends(current_user),
             min_score: int = Query(RISK_MAP_THRESHOLD, ge=RISK_MAP_THRESHOLD, le=100)):
    """Active alerts at or above the risk threshold, located by the account's UK local authority (GSS code).

    The location is the account's recorded local authority, never an IP guess and never a street. Alerts on
    accounts with no la_code are counted in `unlocated` and are not plotted. `version` changes whenever the
    underlying alert set changes, so clients can cheaply detect new events.
    """
    rows = db.execute(
        select(Alert, Transaction, Account.la_code)
        .join(Transaction, Transaction.id == Alert.transaction_id)
        .join(Account, Account.id == Transaction.account_id)
        .where(Alert.risk_score >= min_score, Alert.status != "CLOSED")
        .order_by(Alert.updated_at.desc())
    ).all()
    events, unlocated = [], 0
    for alert, tx, la_code in rows:
        if not la_code:
            unlocated += 1
            continue
        events.append({
            "alert_id": alert.id, "transaction_id": tx.id, "la_code": la_code, "risk_score": alert.risk_score,
            "status": alert.status, "amount": str(tx.amount), "currency": tx.currency, "direction": tx.direction,
            "counterparty": tx.counterparty, "occurred_at": tx.occurred_at, "updated_at": alert.updated_at,
            "location_basis": "account_local_authority",
        })
    latest = max((e["updated_at"] for e in events), default=None)
    version = f"{len(events)}:{unlocated}:{latest.isoformat() if latest else ''}:{sum(e['risk_score'] for e in events)}"
    return {"threshold": min_score, "generated_at": utcnow(), "version": version, "unlocated": unlocated, "events": events}


@router.get("/alerts", response_model=list[AlertOut])
def alerts(db: Session = Depends(get_db), _user: User = Depends(current_user),
           status: str | None = None, priority: str | None = None,
           limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0)):
    stmt = select(Alert).options(selectinload(Alert.transaction).selectinload(Transaction.matches))
    if status:
        stmt = stmt.where(Alert.status == status)
    if priority:
        stmt = stmt.where(Alert.priority == priority)
    return db.scalars(stmt.order_by(Alert.created_at.desc(), Alert.id.desc()).offset(offset).limit(limit)).all()


@router.get("/alerts/{alert_id}", response_model=AlertDetail)
def alert_detail(alert_id: str, db: Session = Depends(get_db), _user: User = Depends(current_user)):
    alert = db.scalar(select(Alert).options(selectinload(Alert.transaction).selectinload(Transaction.matches))
                      .where(Alert.id == alert_id))
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return AlertDetail(**AlertOut.model_validate(alert).model_dump(),
                       matches=[MatchOut.model_validate(m) for m in alert.transaction.matches])


class EvidenceReviewIn(BaseModel):
    note: str | None = Field(default=None, max_length=1000)


@router.get("/alerts/{alert_id}/investigation")
def alert_investigation(alert_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Full investigation workspace. Personal data (IP, addresses) is masked unless the caller is an admin."""
    data = investigation_service.build(db, alert_id, user)
    if data is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    return data


@router.post("/alerts/{alert_id}/evidence-reviewed", status_code=201)
def evidence_reviewed(alert_id: str, payload: EvidenceReviewIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Analyst attests that the evidence was reviewed. Recorded in the tamper-evident audit log."""
    alert = db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    if alert.status == "CLOSED":
        raise HTTPException(status_code=409, detail="Closed cases are immutable")
    if alert.assigned_to and alert.assigned_to != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Case assigned to another analyst")
    append_audit(db, actor=user.email, action="EVIDENCE_REVIEWED", entity_type="alert", entity_id=alert.id,
                 after={"note": payload.note.strip() if payload.note else None})
    db.commit()
    return {"status": "recorded"}


ALLOWED_TRANSITIONS = {
    "OPEN": {"OPEN", "IN_REVIEW", "ESCALATED", "CLOSED"},
    "IN_REVIEW": {"IN_REVIEW", "ESCALATED", "CLOSED"},
    "ESCALATED": {"ESCALATED", "IN_REVIEW", "CLOSED"},
    "CLOSED": {"CLOSED"},
}


@router.patch("/alerts/{alert_id}", response_model=AlertOut)
def review_alert(alert_id: str, payload: AlertReview, db: Session = Depends(get_db),
                 user: User = Depends(current_user)):
    alert = db.scalar(select(Alert).options(selectinload(Alert.transaction))
                      .where(Alert.id == alert_id).with_for_update())
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    if alert.status == "CLOSED":
        raise HTTPException(status_code=409, detail="Closed cases are immutable")
    if payload.status not in ALLOWED_TRANSITIONS[alert.status]:
        raise HTTPException(status_code=409, detail="Invalid alert status transition")
    if alert.assigned_to and alert.assigned_to != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Case assigned to another analyst")
    if payload.status == "CLOSED":
        if not payload.disposition or not payload.note or len(payload.note.strip()) < 10:
            raise HTTPException(status_code=422, detail="Closing a case requires disposition and a note of at least 10 characters")
    elif payload.disposition is not None:
        raise HTTPException(status_code=422, detail="Disposition is only valid when closing a case")
    if payload.confirmed_loss is not None:
        tx = alert.transaction
        if payload.status != "CLOSED" or payload.disposition != "SUSPICIOUS":
            raise HTTPException(status_code=422, detail="A confirmed loss can only be recorded when closing a case as confirmed suspicious")
        if tx.currency != "GBP":
            raise HTTPException(status_code=422, detail="Confirmed loss is recorded in GBP; this transaction is not in GBP")
        if payload.confirmed_loss > tx.amount:
            raise HTTPException(status_code=422, detail="Confirmed loss cannot exceed the transaction amount")
    before = {"status": alert.status, "assigned_to": alert.assigned_to,
              "disposition": alert.disposition, "review_note": alert.review_note,
              "confirmed_loss": str(alert.confirmed_loss) if alert.confirmed_loss is not None else None}
    alert.status = payload.status
    if payload.assign_to_me:
        alert.assigned_to = user.id
    if payload.note:
        alert.review_note = payload.note.strip()
    now = utcnow()
    if alert.opened_at is None and (payload.status in ("IN_REVIEW", "ESCALATED") or payload.assign_to_me):
        alert.opened_at = now
    if payload.status == "CLOSED":
        alert.disposition = payload.disposition
        alert.closed_at = now
        if payload.confirmed_loss is not None:
            alert.confirmed_loss = payload.confirmed_loss
    alert.updated_at = now
    after = {"status": alert.status, "assigned_to": alert.assigned_to,
             "disposition": alert.disposition, "review_note": alert.review_note,
             "confirmed_loss": str(alert.confirmed_loss) if alert.confirmed_loss is not None else None}
    if before != after:
        append_audit(db, actor=user.email, action="ALERT_REVIEWED", entity_type="alert",
                     entity_id=alert.id, before=before, after=after)
        db.commit()
    return alert


@router.get("/merchants", response_model=list[MerchantOut])
def merchants(db: Session = Depends(get_db), _user: User = Depends(current_user)):
    """Verified counterparty -> domain bindings. The UI shows logos only for these."""
    return db.scalars(select(Merchant).order_by(Merchant.name)).all()


@router.post("/merchants", response_model=MerchantOut, status_code=201)
def verify_merchant(payload: MerchantIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """An analyst confirms that a counterparty name belongs to a domain. Audited; never automatic."""
    domain = clean_domain(payload.domain)
    key = normalize_name(payload.name)
    if not domain or len(key) < 2:
        raise HTTPException(status_code=422, detail="A valid merchant name and domain are required")
    merchant = Merchant(name=payload.name.strip(), normalized_name=key, domain=domain, verified_by=user.email)
    db.add(merchant)
    try:
        db.flush()
        append_audit(db, actor=user.email, action="MERCHANT_VERIFIED", entity_type="merchant", entity_id=merchant.id,
                     after={"name": merchant.name, "domain": domain})
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="This merchant already has a verified domain")
    return merchant


@router.get("/brands/search", response_model=BrandSearchOut)
async def brand_search(response: Response, q: str = Query(..., max_length=200), limit: int = Query(5, ge=1, le=10),
                       _user: User = Depends(current_user), service: BrandSearchService = Depends(get_brand_search)):
    """Resolve a merchant name to candidate domains via Logo.dev. Candidates are suggestions only."""
    try:
        return await service.search(q, limit)
    except BrandSearchError as exc:
        headers = {"Retry-After": str(exc.retry_after)} if exc.retry_after else None
        raise HTTPException(status_code=exc.status_code, detail=str(exc), headers=headers)


@router.get("/rules", response_model=list[RuleOut])
def rules(db: Session = Depends(get_db), _user: User = Depends(current_user)):
    return db.scalars(select(RiskRule).order_by(RiskRule.code)).all()


@router.get("/rules/stats")
def rule_stats(db: Session = Depends(get_db), _user: User = Depends(current_user)):
    """Execution statistics: how often each rule has matched, and when it last did."""
    rows = db.execute(select(RuleMatch.rule_code, func.count(RuleMatch.id), func.max(RuleMatch.created_at))
                      .group_by(RuleMatch.rule_code)).all()
    return [{"rule_code": code, "matches": count, "last_matched_at": last} for code, count, last in rows]


@router.post("/rules", response_model=RuleOut, status_code=201)
def create_rule(payload: RuleIn, db: Session = Depends(get_db), user: User = Depends(admin_user)):
    try:
        config = validate_config(payload.kind, payload.config)
    except RuleConfigurationError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    rule = RiskRule(**payload.model_dump(exclude={"config"}), config=config)
    db.add(rule)
    try:
        db.flush()
        append_audit(db, actor=user.email, action="RULE_CREATED", entity_type="rule", entity_id=rule.id,
                     after={"code": rule.code, "kind": rule.kind, "config": rule.config,
                            "weight": rule.weight, "enabled": rule.enabled, "version": rule.version})
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Rule code already exists")
    return rule


@router.patch("/rules/{rule_id}", response_model=RuleOut)
def update_rule(rule_id: str, payload: RuleUpdate, db: Session = Depends(get_db),
                user: User = Depends(admin_user)):
    rule = db.scalar(select(RiskRule).where(RiskRule.id == rule_id).with_for_update())
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    if rule.version != payload.expected_version:
        raise HTTPException(status_code=409, detail="Rule version changed; reload and retry")
    changes = payload.model_dump(exclude_none=True, exclude={"expected_version"})
    if not changes:
        return rule
    if "config" in changes:
        try:
            changes["config"] = validate_config(rule.kind, changes["config"])
        except RuleConfigurationError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
    before = {"name": rule.name, "description": rule.description, "config": rule.config,
              "weight": rule.weight, "enabled": rule.enabled, "version": rule.version}
    for key, value in changes.items():
        setattr(rule, key, value)
    rule.version += 1
    rule.updated_at = utcnow()
    after = {"name": rule.name, "description": rule.description, "config": rule.config,
             "weight": rule.weight, "enabled": rule.enabled, "version": rule.version}
    append_audit(db, actor=user.email, action="RULE_UPDATED", entity_type="rule", entity_id=rule.id,
                 before=before, after=after)
    db.commit()
    return rule


@router.get("/audit", response_model=list[AuditOut])
def audit(db: Session = Depends(get_db), _user: User = Depends(current_user),
          limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0)):
    return db.scalars(select(AuditEvent).order_by(AuditEvent.seq.desc()).offset(offset).limit(limit)).all()


@router.get("/audit/verify")
def audit_verify(db: Session = Depends(get_db), _user: User = Depends(admin_user)):
    return verify_chain(db)


class TrueLayerImportIn(BaseModel):
    code: str = Field(min_length=1, max_length=2000)
    state: str = Field(min_length=1, max_length=4000)


@router.get("/truelayer/connect")
def truelayer_connect(user: User = Depends(admin_user)):
    """Sandbox only: returns the TrueLayer consent URL (UK mock bank)."""
    try:
        return {"auth_url": truelayer.build_auth_url(user.id)}
    except truelayer.TrueLayerError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.post("/truelayer/import")
def truelayer_import(payload: TrueLayerImportIn, db: Session = Depends(get_db), user: User = Depends(admin_user)):
    """Exchange the authorisation code, import accounts + transactions, queue them for screening.

    The access token lives only for this request. Re-importing is idempotent on external_id.
    """
    if not truelayer.verify_state(payload.state, user.id):
        raise HTTPException(status_code=400, detail="Invalid or expired state; start the connection again")
    try:
        token = truelayer.exchange_code(payload.code)
        raw_accounts = truelayer.fetch_accounts(token)
        batches = [(a, truelayer.fetch_transactions(token, a["account_id"])) for a in raw_accounts]
    except truelayer.TrueLayerError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except Exception as exc:
        logger.warning("TrueLayer request failed: %s", type(exc).__name__)
        raise HTTPException(status_code=502, detail="Could not reach TrueLayer")

    imported = skipped = 0
    for raw_account, raw_txs in batches:
        mapped = truelayer.map_account(raw_account)
        if not db.get(Account, mapped["id"]):
            db.add(Account(**mapped))
            db.flush()
        for raw in raw_txs:
            fields = truelayer.map_transaction(raw, mapped["id"])
            if fields is None or db.scalar(select(Transaction.id).where(Transaction.external_id == fields["external_id"])):
                skipped += 1
                continue
            tx = Transaction(**fields)
            db.add(tx)
            db.flush()
            db.add(OutboxEvent(event_type="TRANSACTION_RECEIVED", aggregate_id=tx.id, payload={"external_id": tx.external_id}))
            append_audit(db, actor=user.email, action="TRANSACTION_INGESTED", entity_type="transaction", entity_id=tx.id,
                         after={"external_id": tx.external_id, "account_id": tx.account_id, "amount": str(tx.amount),
                                "currency": tx.currency, "source": "truelayer-sandbox"})
            imported += 1
    db.commit()
    if imported:
        notify_screening()
    return {"accounts": len(batches), "imported": imported, "skipped": skipped}
