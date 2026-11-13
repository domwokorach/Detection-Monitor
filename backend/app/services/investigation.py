"""Compose the investigation workspace payload for one alert.

Role-based masking happens here, server-side, so personal data never reaches an analyst's browser
unmasked. Context signals are informational evidence: the alert's risk score comes only from the
rule matches recorded by screening and is not recomputed or changed here.
"""
import ipaddress
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..models import Account, Alert, AuditEvent, Merchant, RiskRule, Transaction, TransactionContext, User
from .merchants import normalize_name

LONDON = ZoneInfo("Europe/London")
UNUSUAL_HOURS = range(0, 6)  # 00:00-05:59 London time: a documented heuristic, not a policy
SUSPICIOUS = 60
PII_AUDIT_WINDOW = timedelta(minutes=10)


def aware(ts: datetime | None) -> datetime | None:
    if ts is not None and ts.tzinfo is None:
        return ts.replace(tzinfo=timezone.utc)
    return ts


def can_view_pii(user: User) -> bool:
    return user.role == "admin"


def mask_ip(ip: str) -> str:
    addr = ipaddress.ip_address(ip)
    if addr.version == 4:
        return ".".join(ip.split(".")[:3] + ["•••"])
    return ":".join(addr.exploded.split(":")[:2] + ["••••"] * 6)


def _mask_word(value: str | None) -> str | None:
    return None if not value else value[0] + "•" * min(6, max(2, len(value) - 1))


def mask_address(address: dict | None) -> dict | None:
    if not address:
        return None
    out = dict(address)
    for key in ("line1", "line2"):
        out[key] = _mask_word(address.get(key))
    postcode = address.get("postcode")
    out["postcode"] = (postcode.split(" ")[0] + " •••") if postcode else None
    return out


def _address(address: dict | None, reveal: bool) -> dict | None:
    return (address if reveal else mask_address(address)) if address else None


def _opened_at(events: list[AuditEvent], alert: Alert) -> datetime:
    for e in events:
        after = e.after or {}
        if e.action == "ALERT_REVIEWED" and (after.get("status") in ("IN_REVIEW", "ESCALATED") or after.get("assigned_to")):
            return aware(e.created_at)
    return aware(alert.created_at)


def _timeline(events: list[AuditEvent], alert: Alert, tx: Transaction, assignee_names: dict[str, str]) -> list[dict]:
    items: list[dict] = []

    def add(kind, title, at, actor, detail=None, entry=None):
        items.append({"kind": kind, "title": title, "at": aware(at), "actor": actor, "detail": detail,
                      "entry_hash": entry.entry_hash if entry else None, "seq": entry.seq if entry else None})

    for e in events:
        after, before = e.after or {}, e.before or {}
        if e.action == "TRANSACTION_INGESTED":
            add("received", "Transaction received", e.created_at, e.actor, None, e)
        elif e.action == "TRANSACTION_SCREENED":
            add("rules", "Risk rules evaluated", e.created_at, e.actor, f"Risk score {after.get('risk_score', tx.risk_score)}", e)
        elif e.action == "ALERT_CREATED":
            add("alert", "Suspicious alert generated", e.created_at, e.actor, None, e)
        elif e.action == "ALERT_REVIEWED":
            if after.get("assigned_to") and after.get("assigned_to") != before.get("assigned_to"):
                add("assigned", "Analyst assigned", e.created_at, e.actor, f"Assigned to {assignee_names.get(after['assigned_to'], 'an analyst')}", e)
            if after.get("status") != before.get("status"):
                st = after.get("status")
                if st == "IN_REVIEW":
                    add("opened", "Investigation opened", e.created_at, e.actor, None, e)
                elif st == "ESCALATED":
                    add("escalated", "Case escalated", e.created_at, e.actor, None, e)
                elif st == "CLOSED":
                    add("closed", "Case closed", e.created_at, e.actor, f"Disposition: {(after.get('disposition') or '').replace('_', ' ').title()}", e)
            if after.get("review_note") and after.get("review_note") != before.get("review_note"):
                add("note", "Note added", e.created_at, e.actor, after["review_note"], e)
        elif e.action == "EVIDENCE_REVIEWED":
            add("evidence", "Evidence reviewed", e.created_at, e.actor, after.get("note"), e)
    if not any(i["kind"] == "received" for i in items):  # rows created outside the API (seed/import) have no ingest audit
        add("received", "Transaction received", tx.received_at, "system:ingestion")
    items.sort(key=lambda i: (i["at"], i["seq"] or 0))
    return items


def build(db: Session, alert_id: str, user: User) -> dict | None:
    alert = db.scalar(select(Alert).options(selectinload(Alert.transaction).selectinload(Transaction.matches),
                                            selectinload(Alert.transaction).selectinload(Transaction.context))
                      .where(Alert.id == alert_id))
    if not alert:
        return None
    tx = alert.transaction
    account = db.get(Account, tx.account_id)
    merchant = db.scalar(select(Merchant).where(Merchant.normalized_name == normalize_name(tx.counterparty)))
    reveal = can_view_pii(user)
    ctx = tx.context

    events = db.scalars(select(AuditEvent).where(AuditEvent.entity_id.in_([alert.id, tx.id])).order_by(AuditEvent.seq)).all()
    users = {u.id: u.display_name for u in db.scalars(select(User))}
    assignee = {"id": alert.assigned_to, "display_name": users.get(alert.assigned_to, "Unknown analyst")} if alert.assigned_to else None
    reviews = [e for e in events if e.action == "ALERT_REVIEWED"]

    # ---- IP intelligence -----------------------------------------------------------------------
    ip = None
    related_points: list[dict] = []
    sharing_accounts: set[str] = set()
    if ctx:
        same_ip = db.scalars(select(Transaction).join(TransactionContext, TransactionContext.transaction_id == Transaction.id)
                             .where(TransactionContext.source_ip == ctx.source_ip).order_by(Transaction.occurred_at)).all()
        sharing_accounts = {t.account_id for t in same_ip}
        times = [aware(t.occurred_at) for t in same_ip]
        alert_ids = db.scalars(select(Alert.id).where(Alert.transaction_id.in_([t.id for t in same_ip]))).all()
        has_geo = ctx.geo_lat is not None and ctx.geo_lon is not None
        ip = {
            "address": ctx.source_ip if reveal else mask_ip(ctx.source_ip), "masked": not reveal,
            "version": ipaddress.ip_address(ctx.source_ip).version,
            "telemetry": {"source": "Captured with the transaction", "captured_at": aware(ctx.captured_at)},
            "geo": {"country": ctx.geo_country, "region": ctx.geo_region, "county": ctx.geo_county, "city": ctx.geo_city,
                    "la_code": ctx.geo_la_code, "lat": ctx.geo_lat if has_geo else None, "lon": ctx.geo_lon if has_geo else None,
                    "accuracy_km": ctx.geo_accuracy_km, "provider": ctx.geo_provider, "confidence": ctx.geo_confidence,
                    "inferred": True},
            "network": {"isp": ctx.isp, "asn": ctx.asn},
            "vpn_proxy": ctx.is_vpn, "reputation": ctx.reputation,
            "first_seen": min(times), "last_seen": max(times),
            "related_transactions": max(0, len(same_ip) - 1), "related_alerts": max(0, len(alert_ids) - (1 if alert.id in alert_ids else 0)),
            "accounts_sharing": len(sharing_accounts),
        }
        pts = db.execute(select(Transaction, TransactionContext).join(TransactionContext, TransactionContext.transaction_id == Transaction.id)
                         .where(Transaction.risk_score >= SUSPICIOUS, TransactionContext.geo_lat.is_not(None),
                                (Transaction.account_id == tx.account_id) | (TransactionContext.source_ip == ctx.source_ip))
                         .order_by(Transaction.occurred_at.desc()).limit(25)).all()
        related_points = [{"transaction_id": t.id, "risk_score": t.risk_score, "lat": c.geo_lat, "lon": c.geo_lon, "city": c.geo_city,
                           "country": c.geo_country, "la_code": c.geo_la_code, "accuracy_km": c.geo_accuracy_km, "counterparty": t.counterparty,
                           "amount": str(t.amount), "currency": t.currency, "occurred_at": aware(t.occurred_at), "current": t.id == tx.id}
                          for t, c in pts]

    # ---- risk context signals ------------------------------------------------------------------
    home = account.home_country if account else None
    factors: list[dict] = []

    def factor(code, label, status, explanation, evidence=None):
        factors.append({"code": code, "label": label, "status": status, "explanation": explanation, "evidence": evidence})

    if ctx and ctx.geo_country:
        mismatch = ctx.geo_country != tx.country or (home is not None and ctx.geo_country != home)
        factor("IP_COUNTRY_MISMATCH", "IP and transaction country mismatch", "flagged" if mismatch else "clear",
               f"IP estimated in {ctx.geo_country}; payment destination {tx.country}; account home {home or 'unknown'}.",
               f"Provider estimate ({ctx.geo_provider or 'unknown provider'}), not a verified location.")
    else:
        factor("IP_COUNTRY_MISMATCH", "IP and transaction country mismatch", "unavailable", "No IP-based country estimate is available for this transaction.")
    local = aware(tx.occurred_at).astimezone(LONDON)
    factor("UNUSUAL_TIME", "Unusual transaction time", "flagged" if local.hour in UNUSUAL_HOURS else "clear",
           f"Payment made at {local:%H:%M} UK time. Heuristic: 00:00–05:59 is treated as unusual.", f"{local:%d %b %Y %H:%M %Z}")
    window = [t for t in db.scalars(select(Transaction).where(Transaction.account_id == tx.account_id, Transaction.direction == "DEBIT"))
              if timedelta(0) <= aware(tx.occurred_at) - aware(t.occurred_at) <= timedelta(hours=1)]
    factor("VELOCITY", "Velocity of recent payments", "flagged" if len(window) >= 3 else "clear",
           f"{len(window)} outgoing payment(s) from this account in the hour up to this transaction.", None)
    if ctx:
        factor("SHARED_IP", "Multiple accounts using the same IP", "flagged" if len(sharing_accounts) > 1 else "clear",
               f"{len(sharing_accounts)} account(s) have transacted from this source IP.", None)
    else:
        factor("SHARED_IP", "Multiple accounts using the same IP", "unavailable", "No source IP was captured for this transaction.")
    threshold = None
    for rule in db.scalars(select(RiskRule).where(RiskRule.kind == "AMOUNT_THRESHOLD", RiskRule.enabled.is_(True))):
        try:
            value = float(rule.config.get("minimum"))
            threshold = value if threshold is None else min(threshold, value)
        except (TypeError, ValueError):
            continue
    if threshold is None:
        factor("HIGH_VALUE", "High-value transaction", "unavailable", "No amount-threshold rule is enabled to define high value.")
    else:
        factor("HIGH_VALUE", "High-value transaction", "flagged" if float(tx.amount) >= threshold else "clear",
               f"£{float(tx.amount):,.2f} against the configured threshold of £{threshold:,.2f}." if tx.currency == "GBP"
               else f"{tx.amount} {tx.currency} against a threshold of {threshold:,.2f}.", None)

    # ---- linked investigations -----------------------------------------------------------------
    linked: list[dict] = []
    others = db.scalars(select(Alert).options(selectinload(Alert.transaction).selectinload(Transaction.context))
                        .where(Alert.id != alert.id, Alert.risk_score >= SUSPICIOUS).order_by(Alert.created_at.desc())).all()
    for o in others:
        reasons = []
        if ctx and o.transaction.context and o.transaction.context.source_ip == ctx.source_ip:
            reasons.append("Same source IP")
        if o.transaction.account_id == tx.account_id:
            reasons.append("Same account")
        if normalize_name(o.transaction.counterparty) == normalize_name(tx.counterparty):
            reasons.append("Same merchant name")
        if reasons:
            linked.append({"alert_id": o.id, "risk_score": o.risk_score, "status": o.status, "counterparty": o.transaction.counterparty,
                           "reason": ", ".join(reasons), "created_at": aware(o.created_at)})
    linked = linked[:10]

    # ---- PII access audit (deduplicated so polling does not flood the log) ---------------------
    pii_shown = reveal and bool(ctx or (account and account.address) or (merchant and merchant.address))
    if pii_shown:
        from .audit import append_audit
        recent = db.scalar(select(AuditEvent).where(AuditEvent.action == "INVESTIGATION_PII_VIEWED", AuditEvent.actor == user.email,
                                                    AuditEvent.entity_id == alert.id).order_by(AuditEvent.seq.desc()).limit(1))
        if not recent or datetime.now(timezone.utc) - aware(recent.created_at) > PII_AUDIT_WINDOW:
            append_audit(db, actor=user.email, action="INVESTIGATION_PII_VIEWED", entity_type="alert", entity_id=alert.id,
                         after={"ip": bool(ctx), "customer_address": bool(account and account.address)})
            db.commit()

    received = aware(tx.received_at)
    return {
        "alert_id": alert.id,
        "case_ref": f"INV-{alert.id.replace('-', '')[-5:].upper()}",
        "account": {"id": tx.account_id, "holder_name": account.holder_name if account else None,
                    "account_number_masked": account.account_number_masked if account else None, "home_country": home},
        "merchant": {"name": tx.counterparty, "domain": merchant.domain if merchant else None},
        "assignee": assignee,
        "can_view_pii": reveal,
        "timestamps": {"transaction": aware(tx.occurred_at), "received": received, "detected": aware(alert.created_at),
                       "opened": _opened_at(reviews, alert), "last_activity": aware(alert.updated_at),
                       "reviewed": aware(reviews[-1].created_at) if reviews else None,
                       "processing_seconds": max(0.0, (aware(alert.created_at) - received).total_seconds()) if received else None},
        "ip": ip,
        "addresses": {"masked": not reveal,
                      "customer": _address(account.address if account else None, reveal),
                      "merchant": _address(merchant.address if merchant else None, reveal)},
        "factors": factors,
        "linked": linked,
        "related_points": related_points,
        "timeline": _timeline(events, alert, tx, users),
    }
