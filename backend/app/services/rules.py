"""Deterministic, configurable rule engine. Threshold amounts are in transaction currency."""
from datetime import timedelta
from decimal import Decimal, InvalidOperation
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from ..models import RiskRule, Transaction

RULE_KINDS = {"AMOUNT_THRESHOLD", "COUNTRY_WATCHLIST", "VELOCITY", "CUMULATIVE_AMOUNT"}


class RuleConfigurationError(ValueError):
    pass


def positive_decimal(value, field: str) -> Decimal:
    try:
        d = Decimal(str(value))
        if not d.is_finite() or d <= 0:
            raise ValueError()
        return d
    except (ValueError, InvalidOperation, TypeError):
        raise RuleConfigurationError(f"{field} must be a positive number")


def positive_int(value, field: str, *, min_value: int = 1, max_value: int = 10080) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not min_value <= value <= max_value:
        raise RuleConfigurationError(f"{field} must be an integer between {min_value} and {max_value}")
    return value


def validate_config(kind: str, config: dict) -> dict:
    if kind not in RULE_KINDS:
        raise RuleConfigurationError(f"Unsupported rule kind: {kind}")
    if not isinstance(config, dict):
        raise RuleConfigurationError("Rule config must be an object")
    if kind == "AMOUNT_THRESHOLD":
        if set(config) != {"minimum"}:
            raise RuleConfigurationError("AMOUNT_THRESHOLD requires {minimum}")
        return {"minimum": str(positive_decimal(config["minimum"], "minimum"))}
    if kind == "COUNTRY_WATCHLIST":
        countries = config.get("countries")
        if not set(config) <= {"countries", "list_type"} or not isinstance(countries, list) or not countries:
            raise RuleConfigurationError("COUNTRY_WATCHLIST requires nonempty countries list")
        if any(not isinstance(c, str) or len(c) != 2 or not c.isalpha() for c in countries):
            raise RuleConfigurationError("countries must be two-letter country codes")
        cleaned = {"countries": sorted(set(c.upper() for c in countries))}
        if "list_type" in config:
            if config["list_type"] not in {"SANCTIONS", "PEP", "OTHER"}:
                raise RuleConfigurationError("list_type must be SANCTIONS, PEP or OTHER")
            cleaned["list_type"] = config["list_type"]
        return cleaned
    if kind == "VELOCITY":
        if set(config) != {"window_minutes", "min_count"}:
            raise RuleConfigurationError("VELOCITY requires {window_minutes, min_count}")
        return {"window_minutes": positive_int(config["window_minutes"], "window_minutes"),
                "min_count": positive_int(config["min_count"], "min_count", max_value=1000)}
    if set(config) != {"window_minutes", "minimum_total"}:
        raise RuleConfigurationError("CUMULATIVE_AMOUNT requires {window_minutes, minimum_total}")
    return {"window_minutes": positive_int(config["window_minutes"], "window_minutes"),
            "minimum_total": str(positive_decimal(config["minimum_total"], "minimum_total"))}


def evaluate(db: Session, tx: Transaction, rule: RiskRule) -> str | None:
    config = validate_config(rule.kind, rule.config)
    if rule.kind == "AMOUNT_THRESHOLD":
        minimum = Decimal(config["minimum"])
        if tx.amount >= minimum:
            return f"Amount {tx.amount} {tx.currency} meets configured threshold {minimum} {tx.currency}"
    elif rule.kind == "COUNTRY_WATCHLIST":
        if tx.country in config["countries"]:
            return f"Destination country {tx.country} is in analyst-configured watchlist"
    elif tx.direction == "DEBIT":
        # Direction, currency and occurred_at are part of the event-time window.
        # Ingesting late events is reproducible for the event being scored, but
        # does not automatically rescore transactions processed earlier.
        start = tx.occurred_at - timedelta(minutes=config["window_minutes"])
        where = (
            Transaction.account_id == tx.account_id,
            Transaction.currency == tx.currency,
            Transaction.direction == "DEBIT",
            Transaction.id != tx.id,
            Transaction.occurred_at >= start,
            Transaction.occurred_at <= tx.occurred_at,
        )
        if rule.kind == "VELOCITY":
            count = db.scalar(select(func.count(Transaction.id)).where(*where)) or 0
            if count + 1 >= config["min_count"]:
                return f"{count + 1} outgoing transactions within {config['window_minutes']} minutes"
        elif rule.kind == "CUMULATIVE_AMOUNT":
            total = (db.scalar(select(func.sum(Transaction.amount)).where(*where)) or Decimal("0")) + tx.amount
            if total >= Decimal(config["minimum_total"]):
                return f"Outgoing amount totals {total} {tx.currency} within {config['window_minutes']} minutes"
    return None
