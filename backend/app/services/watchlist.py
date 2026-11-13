"""Watchlist hit analytics. A hit is one transaction that matched an enabled COUNTRY_WATCHLIST rule.

`rule_matches` is unique per (transaction, rule), so a transaction that trips two watchlist rules is
collapsed to a single hit (deduplicated by transaction). Nothing here is estimated or generated.
"""
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, func
from sqlalchemy.orm import Session, selectinload
from ..models import RiskRule, RuleMatch, Transaction, Alert, utcnow

HIGH_RISK_SCORE = 60  # same threshold as the risk map and the dashboard "high" band
RANGES = {  # range -> (window, bucket)
    "1h": (timedelta(hours=1), timedelta(minutes=1)),
    "24h": (timedelta(hours=24), timedelta(minutes=15)),
    "7d": (timedelta(days=7), timedelta(hours=2)),
    "30d": (timedelta(days=30), timedelta(hours=6)),
}
CATEGORY_ORDER = ("SANCTIONS", "PEP", "OTHER")  # a transaction in several lists takes the most severe


def aware(d: datetime) -> datetime:
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def _iso(d: datetime) -> str:
    return aware(d).astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def hits_since(db: Session, since: datetime) -> list[dict]:
    """Distinct watchlist hits first detected at or after `since`, oldest first."""
    rows = db.execute(
        select(RuleMatch.transaction_id, func.min(RuleMatch.created_at))
        .join(RiskRule, RiskRule.id == RuleMatch.rule_id).where(RiskRule.kind == "COUNTRY_WATCHLIST")
        .group_by(RuleMatch.transaction_id)).all()
    detected = {tx_id: aware(at) for tx_id, at in rows if aware(at) >= since}
    if not detected:
        return []
    txs = db.scalars(select(Transaction).options(selectinload(Transaction.matches), selectinload(Transaction.alert))
                     .where(Transaction.id.in_(detected))).all()
    kinds = {r.id: r for r in db.scalars(select(RiskRule).where(RiskRule.kind == "COUNTRY_WATCHLIST")).all()}
    hits = []
    for tx in txs:
        rules = [kinds[m.rule_id] for m in tx.matches if m.rule_id in kinds]
        types = {(r.config or {}).get("list_type", "OTHER") for r in rules}
        category = next(c for c in CATEGORY_ORDER if c in types)
        hits.append({
            "id": tx.id, "transaction_id": tx.id, "alert_id": tx.alert.id if tx.alert else None,
            "alert_status": tx.alert.status if tx.alert else None, "detected_at": detected[tx.id],
            "category": category, "risk_score": tx.risk_score, "high_risk": tx.risk_score >= HIGH_RISK_SCORE,
            "country": tx.country, "counterparty": tx.counterparty, "rule_codes": sorted(r.code for r in rules),
        })
    return sorted(hits, key=lambda h: (h["detected_at"], h["id"]))


def build(db: Session, range_key: str) -> dict:
    window, bucket = RANGES[range_key]
    now = utcnow()
    # Align bucket edges to the epoch so they stay stable between refreshes.
    step = int(bucket.total_seconds())
    end = datetime.fromtimestamp((int(now.timestamp()) // step + 1) * step, tz=timezone.utc)
    start = end - window
    hits = hits_since(db, start)
    n = int(window / bucket)
    buckets = [{"t": _iso(start + bucket * i), "total": 0, "high_risk": 0, "sanctions": 0, "pep": 0, "other": 0} for i in range(n)]
    for h in hits:
        i = min(n - 1, int((h["detected_at"] - start).total_seconds() // step))
        b = buckets[i]
        b["total"] += 1
        b["high_risk"] += int(h["high_risk"])
        b[h["category"].lower()] += 1
    alerted = [h for h in hits if h["alert_status"]]
    totals = {
        "total": len(hits), "high_risk": sum(h["high_risk"] for h in hits),
        "sanctions": sum(h["category"] == "SANCTIONS" for h in hits), "pep": sum(h["category"] == "PEP" for h in hits),
        "other": sum(h["category"] == "OTHER" for h in hits),
        "unreviewed": sum(h["alert_status"] == "OPEN" for h in alerted),
        "escalated": sum(h["alert_status"] == "ESCALATED" for h in alerted),
    }
    latest = max((h["detected_at"] for h in hits), default=None)
    recent = [{**h, "detected_at": _iso(h["detected_at"])} for h in hits[-50:]][::-1]
    return {"range": range_key, "generated_at": _iso(now), "window_start": _iso(start), "window_end": _iso(end),
            "bucket_seconds": step, "high_risk_threshold": HIGH_RISK_SCORE, "totals": totals, "buckets": buckets,
            "events": recent, "version": f"{totals['total']}:{totals['unreviewed']}:{totals['escalated']}:{_iso(latest) if latest else ''}"}


def change_version(db: Session) -> str:
    """Cheap fingerprint of everything the KPIs depend on; the SSE stream emits when it changes."""
    matches = db.execute(select(func.count(func.distinct(RuleMatch.transaction_id)), func.max(RuleMatch.created_at))
                         .join(RiskRule, RiskRule.id == RuleMatch.rule_id).where(RiskRule.kind == "COUNTRY_WATCHLIST")).one()
    alerts = db.execute(select(func.count(Alert.id), func.max(Alert.updated_at))).one()
    return f"{matches[0]}:{matches[1]}:{alerts[0]}:{alerts[1]}"
