"""Append-only SHA-256-linked audit log. Detects modification, not DB-admin deletion of entire history."""
import hashlib
import json
from datetime import timezone
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..models import AuditHead, AuditEvent, utcnow, new_id

GENESIS = "0" * 64


def canonical(entry: dict) -> str:
    return json.dumps(entry, sort_keys=True, separators=(",", ":"), ensure_ascii=True, default=str)


def event_payload(event: AuditEvent) -> dict:
    timestamp = event.created_at
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
    return dict(
        id=event.id, actor=event.actor, action=event.action,
        entity_type=event.entity_type, entity_id=event.entity_id,
        before=event.before, after=event.after,
        created_at=timestamp.isoformat(), previous_hash=event.previous_hash,
    )


def append_audit(db: Session, *, actor: str, action: str, entity_type: str,
                 entity_id: str, before: dict | None = None, after: dict | None = None) -> AuditEvent:
    head = db.scalar(select(AuditHead).where(AuditHead.id == 1).with_for_update())
    if head is None:
        # Initialized at DB bootstrap. This branch is useful for isolated unit tests.
        head = AuditHead(id=1, last_hash=GENESIS)
        db.add(head)
        db.flush()
    event = AuditEvent(
        id=new_id(), actor=actor, action=action, entity_type=entity_type,
        entity_id=entity_id, before=before, after=after, created_at=utcnow(),
        previous_hash=head.last_hash, entry_hash="",
    )
    event.entry_hash = hashlib.sha256(canonical(event_payload(event)).encode()).hexdigest()
    head.last_hash = event.entry_hash
    db.add(event)
    db.flush()
    return event


def verify_chain(db: Session) -> dict:
    previous = GENESIS
    checked = 0
    for event in db.scalars(select(AuditEvent).order_by(AuditEvent.seq)):
        digest = hashlib.sha256(canonical(event_payload(event)).encode()).hexdigest()
        checked += 1
        if event.previous_hash != previous or event.entry_hash != digest:
            return {"valid": False, "checked": checked, "broken_at_seq": event.seq}
        previous = event.entry_hash
    head = db.get(AuditHead, 1)
    if head and head.last_hash != previous:
        return {"valid": False, "checked": checked, "broken_at_seq": "HEAD"}
    return {"valid": True, "checked": checked, "last_hash": previous}
