"""Transactional outbox consumer; safe to retry and safe to lose Redis wakeups."""
import logging
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..models import Account, Transaction, RiskRule, RuleMatch, Alert, OutboxEvent, utcnow
from ..config import settings
from .rules import evaluate
from .audit import append_audit

logger = logging.getLogger(__name__)
MAX_ATTEMPTS = 5


def screen(db: Session, tx: Transaction, *, threshold: int | None = None) -> Alert | None:
    """Run only inside a DB transaction, with the outbox event locked by caller."""
    if tx.screening_status == "SCREENED":
        return tx.alert
    if tx.screening_status == "FAILED":
        return None
    # Serialise screening per account: window rules read other transactions' committed
    # state, so parallel workers on one account could each undercount the other.
    db.scalar(select(Account.id).where(Account.id == tx.account_id).with_for_update())
    score = 0
    matched_codes = []
    rules = db.scalars(select(RiskRule).where(RiskRule.enabled.is_(True)).order_by(RiskRule.code)).all()
    for rule in rules:
        reason = evaluate(db, tx, rule)
        if reason is not None:
            db.add(RuleMatch(transaction_id=tx.id, rule_id=rule.id, rule_code=rule.code,
                             rule_version=rule.version, rule_config_snapshot=dict(rule.config), score=rule.weight, reason=reason))
            matched_codes.append(rule.code)
            score += rule.weight
    tx.risk_score = min(100, score)
    tx.screening_status = "SCREENED"
    target_threshold = threshold if threshold is not None else settings.alert_threshold
    alert = None
    if tx.risk_score >= target_threshold:
        priority = "HIGH" if tx.risk_score >= 75 else "MEDIUM" if tx.risk_score >= 50 else "LOW"
        alert = Alert(transaction_id=tx.id, risk_score=tx.risk_score, priority=priority)
        db.add(alert)
        db.flush()
        append_audit(db, actor="system:screening", action="ALERT_CREATED", entity_type="alert",
                     entity_id=alert.id, after={"transaction_id": tx.id, "risk_score": tx.risk_score,
                                                "priority": priority, "matched_rule_codes": matched_codes})
    append_audit(db, actor="system:screening", action="TRANSACTION_SCREENED", entity_type="transaction",
                 entity_id=tx.id, after={"risk_score": tx.risk_score, "rule_codes": matched_codes,
                                          "alert_id": alert.id if alert else None})
    return alert


def process_next(db: Session, *, threshold: int | None = None) -> bool:
    """Processes at most one event. PostgreSQL SKIP LOCKED enables parallel workers.

    Commit is the dequeue ack: transaction screening and event completion are atomic.
    """
    event = db.scalar(
        select(OutboxEvent).where(OutboxEvent.processed_at.is_(None))
        .order_by(OutboxEvent.created_at, OutboxEvent.id)
        .with_for_update(skip_locked=True).limit(1)
    )
    if event is None:
        return False
    try:
        if event.event_type != "TRANSACTION_RECEIVED":
            raise ValueError(f"Unknown event type: {event.event_type}")
        tx = db.scalar(select(Transaction).where(Transaction.id == event.aggregate_id).with_for_update())
        if tx is None:
            raise ValueError(f"Missing transaction: {event.aggregate_id}")
        screen(db, tx, threshold=threshold)
        event.processed_at = utcnow()
        event.last_error = None
        db.commit()
    except Exception as exc:
        logger.exception("Outbox event %s failed", event.id)
        event_id = event.id
        db.rollback()
        failed_event = db.get(OutboxEvent, event_id, with_for_update=True)
        if failed_event:
            failed_event.attempts += 1
            failed_event.last_error = str(exc)[:1000]
            if failed_event.attempts >= MAX_ATTEMPTS:
                failed_event.processed_at = utcnow()
                tx = db.get(Transaction, failed_event.aggregate_id)
                if tx:
                    tx.screening_status = "FAILED"
                append_audit(db, actor="system:screening", action="SCREENING_FAILED",
                             entity_type="transaction", entity_id=failed_event.aggregate_id,
                             after={"attempts": failed_event.attempts, "error": failed_event.last_error})
            db.commit()
    return True


def drain(db: Session, *, limit: int = 100, threshold: int | None = None) -> int:
    processed = 0
    for _ in range(limit):
        if not process_next(db, threshold=threshold):
            break
        processed += 1
    return processed
