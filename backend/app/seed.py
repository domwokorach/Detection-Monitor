"""Idempotent synthetic fixtures; do not use as real compliance risk policy."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import os
from sqlalchemy import select
from sqlalchemy.orm import Session
from .models import User, Account, RiskRule, Transaction, OutboxEvent, AuditHead, Merchant, TransactionContext
from .services.merchants import normalize_name
from .services.rules import validate_config
from .security import hash_password
from .db import Base, engine, SessionLocal


SAMPLE_RULES = [
    ("LARGE_AMOUNT", "Large outgoing amount", "Single payment above a configured amount",
     "AMOUNT_THRESHOLD", {"minimum": "10000"}, 50),
    ("WATCHLIST_COUNTRY", "Configured destination watchlist", "Synthetic ZZ code is for demonstration, not sanctions guidance",
     "COUNTRY_WATCHLIST", {"countries": ["ZZ"]}, 65),
    ("HIGH_VELOCITY", "Rapid outgoing payments", "Multiple payments from one account within a short window",
     "VELOCITY", {"window_minutes": 10, "min_count": 3}, 45),
    ("OUTFLOW_SPIKE", "Elevated cumulative outflow", "Sum of recent outgoing payments exceeds threshold",
     "CUMULATIVE_AMOUNT", {"window_minutes": 60, "minimum_total": "15000"}, 35),
]

# Analyst-verified counterparty -> domain bindings. Logos are shown only for names listed here.
SAMPLE_MERCHANTS = [("Amazon", "amazon.co.uk"), ("Tesco", "tesco.com"), ("Spotify", "spotify.com"),
                    ("Apple Store", "apple.com"), ("Currys", "currys.co.uk"), ("Barclays", "barclays.co.uk")]


# Synthetic customer addresses (fictional, for the demo only). Real deployments supply these from an authorised source.
SAMPLE_ADDRESSES = {
    "acct-retail-01": {"line1": "14 Example Street", "line2": "Unit 2", "city": "Manchester", "county": "Greater Manchester", "postcode": "M1 1AA", "country": "GB", "source": "synthetic-demo"},
    "acct-trading-02": {"line1": "9 Sample Lane", "line2": None, "city": "London", "county": "Greater London", "postcode": "EC1A 1BB", "country": "GB", "source": "synthetic-demo"},
    "acct-personal-03": {"line1": "3 Placeholder Road", "line2": None, "city": "Cardiff", "county": "South Glamorgan", "postcode": "CF10 1AA", "country": "GB", "source": "synthetic-demo"},
}
# Synthetic IP telemetry on RFC 5737 / 3849 documentation addresses, so no real host is implied. Geo values are
# illustrative estimates attributed to "synthetic-demo"; they are not a real lookup result.
_LON = dict(geo_country="GB", geo_region="England", geo_county="Greater London", geo_city="London", geo_lat=51.509, geo_lon=-0.118, geo_accuracy_km=8.0, geo_la_code="E09000001")
_MAN = dict(geo_country="GB", geo_region="England", geo_county="Greater Manchester", geo_city="Manchester", geo_lat=53.483, geo_lon=-2.244, geo_accuracy_km=10.0, geo_la_code="E08000003")
_FRA = dict(geo_country="DE", geo_region="Hesse", geo_city="Frankfurt am Main", geo_lat=50.11, geo_lon=8.682, geo_accuracy_km=25.0)
SAMPLE_CONTEXTS = {
    "SYN-002": dict(source_ip="203.0.113.24", isp="Example Broadband", asn="AS64496", is_vpn=False, reputation="clean", geo_confidence="medium", geo_provider="synthetic-demo", **_MAN),
    "SYN-006": dict(source_ip="198.51.100.77", isp="Example Hosting GmbH", asn="AS64497", is_vpn=True, reputation="suspicious", geo_confidence="low", geo_provider="synthetic-demo", **_FRA),
    "SYN-005": dict(source_ip="198.51.100.77", isp="Example Hosting GmbH", asn="AS64497", is_vpn=True, reputation="suspicious", geo_confidence="low", geo_provider="synthetic-demo", **_FRA),
    "SYN-009": dict(source_ip="198.51.100.77", isp="Example Hosting GmbH", asn="AS64497", is_vpn=True, reputation="suspicious", geo_confidence="low", geo_provider="synthetic-demo", **_FRA),
    "SYN-HIGH-01": dict(source_ip="198.51.100.77", isp="Example Hosting GmbH", asn="AS64497", is_vpn=True, reputation="suspicious", geo_confidence="low", geo_provider="synthetic-demo", **_FRA),
    "SYN-BURST-1": dict(source_ip="203.0.113.50", isp="Example Mobile", asn="AS64498", is_vpn=None, reputation=None, geo_confidence="low", geo_provider="synthetic-demo", **_LON),
    "SYN-BURST-4": dict(source_ip="203.0.113.50", isp="Example Mobile", asn="AS64498", is_vpn=None, reputation=None, geo_confidence="low", geo_provider="synthetic-demo", **_LON),
}


def seed_demo(db: Session):
    if db.get(AuditHead, 1) is None:
        db.add(AuditHead(id=1, last_hash="0" * 64))
    if not db.scalar(select(User.id).limit(1)):
        db.add_all([
            User(email="admin@demo.local", display_name="Morgan Admin", role="admin",
                 password_hash=hash_password(os.getenv("DEMO_ADMIN_PASSWORD", "ChangeMe123!"))),
            User(email="analyst@demo.local", display_name="Avery Analyst", role="analyst",
                 password_hash=hash_password(os.getenv("DEMO_ANALYST_PASSWORD", "ChangeMe123!"))),
        ])
    if not db.scalar(select(Account.id).limit(1)):
        db.add_all([
            Account(id="acct-retail-01", account_number_masked="•••• 1042", holder_name="Northstar Retail", home_country="GB", la_code="E08000003"),
            Account(id="acct-trading-02", account_number_masked="•••• 8805", holder_name="Oakline Trading", home_country="GB", la_code="E09000001"),
            Account(id="acct-personal-03", account_number_masked="•••• 6291", holder_name="Rivera Personal", home_country="GB", la_code="W06000015"),
        ])
    # Back-fill locations on demo accounts created before la_code existed.
    for acct_id, la in {"acct-retail-01": "E08000003", "acct-trading-02": "E09000001", "acct-personal-03": "W06000015"}.items():
        acct = db.get(Account, acct_id)
        if acct and acct.la_code is None:
            acct.la_code = la
    for acct_id, address in SAMPLE_ADDRESSES.items():
        acct = db.get(Account, acct_id)
        if acct and acct.address is None:
            acct.address = address
    for code, name, description, kind, config, weight in SAMPLE_RULES:
        if not db.scalar(select(RiskRule.id).where(RiskRule.code == code)):
            db.add(RiskRule(code=code, name=name, description=description, kind=kind,
                            config=validate_config(kind, config), weight=weight, enabled=True))
    for name, domain in SAMPLE_MERCHANTS:
        if not db.scalar(select(Merchant.id).where(Merchant.normalized_name == normalize_name(name))):
            db.add(Merchant(name=name, normalized_name=normalize_name(name), domain=domain, verified_by="seed"))
    db.commit()
    if db.scalar(select(Transaction.id).limit(1)):
        return
    now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    # Same-currency, recent debit activity causes deterministic velocity/outflow matches.
    rows = [
        ("acct-personal-03", "210.00", "GB", "Café purchase", -6, 13),
        ("acct-retail-01", "12400.00", "US", "Meridian Goods", -6, 10),
        ("acct-trading-02", "550.00", "ZZ", "Training Example LLC", -5, 13),
        ("acct-personal-03", "85.00", "GB", "Online shopping", -5, 8),
        ("acct-retail-01", "1320.00", "FR", "Alpine Supplies", -4, 13),
        ("acct-trading-02", "19450.00", "DE", "Stonebridge Wholesale", -3, 11),
        ("acct-retail-01", "260.00", "GB", "Stationery House", -2, 14),
        ("acct-personal-03", "290.00", "US", "Software Subscription", -2, 9),
        ("acct-trading-02", "400.00", "ZZ", "Synthetic Destination", -1, 9),
        ("acct-retail-01", "800.00", "GB", "Courier Direct", -1, 12),
        ("acct-personal-03", "64.18", "GB", "Tesco", -4, 17),
        ("acct-personal-03", "10.99", "GB", "Spotify", -3, 7),
        ("acct-retail-01", "230.00", "GB", "Amazon", -2, 16),
        ("acct-trading-02", "12499.00", "DE", "Apple Store", -1, 15),
        ("acct-trading-02", "1899.00", "ZZ", "Currys", -1, 16),
    ]
    events = []
    for index, (account, amount, country, counterparty, days, hour) in enumerate(rows):
        occurred = (now + timedelta(days=days)).replace(hour=hour, minute=0)
        events.append((f"SYN-{index+1:03d}", account, amount, country, counterparty, occurred))
    # Small transactions fall in a ten-minute burst for demo velocity detection.
    for index, amount in enumerate(["950", "1050", "1100", "1150"]):
        events.append((f"SYN-BURST-{index+1}", "acct-retail-01", amount, "GB",
                       f"Batch Transfer {index+1}", now - timedelta(minutes=16 - index * 3)))
    events.append(("SYN-HIGH-01", "acct-trading-02", "23890.00", "DE", "Blue Harbor Partners", now - timedelta(minutes=7)))
    events.append(("SYN-LOW-01", "acct-personal-03", "49.95", "GB", "Green Market", now - timedelta(minutes=3)))
    for external_id, account_id, amount, country, counterparty, occurred_at in events:
        tx = Transaction(external_id=external_id, account_id=account_id, amount=Decimal(amount),
                         currency="GBP", direction="DEBIT", country=country,
                         counterparty=counterparty, occurred_at=occurred_at)
        db.add(tx)
        db.flush()
        if external_id in SAMPLE_CONTEXTS:
            db.add(TransactionContext(transaction_id=tx.id, captured_at=occurred_at, **SAMPLE_CONTEXTS[external_id]))
        db.add(OutboxEvent(event_type="TRANSACTION_RECEIVED", aggregate_id=tx.id,
                           payload={"external_id": tx.external_id}))
    db.commit()


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        seed_demo(session)
    print("Synthetic demo data seeded")
