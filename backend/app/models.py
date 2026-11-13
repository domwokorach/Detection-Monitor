"""Domain model. Money uses Decimal/NUMERIC, never binary floating point."""
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4
from sqlalchemy import (
    String, Integer, DateTime, ForeignKey, Boolean, Numeric,
    JSON, Text, UniqueConstraint, Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base


def utcnow():
    return datetime.now(timezone.utc)


def new_id():
    return str(uuid4())


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="analyst")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Account(Base):
    __tablename__ = "accounts"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    account_number_masked: Mapped[str] = mapped_column(String(32), unique=True)
    holder_name: Mapped[str] = mapped_column(String(120))
    home_country: Mapped[str] = mapped_column(String(2), default="GB")
    # ONS GSS code of the UK local authority the account is based in (drives the risk map); optional.
    la_code: Mapped[str | None] = mapped_column(String(9), nullable=True)
    # Registered address, only when supplied by an authorised source. Personal data: masked by role on read.
    address: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Transaction(Base):
    __tablename__ = "transactions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    external_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id"), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    currency: Mapped[str] = mapped_column(String(3))
    direction: Mapped[str] = mapped_column(String(8))
    counterparty: Mapped[str] = mapped_column(String(160))
    country: Mapped[str] = mapped_column(String(2))
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    screening_status: Mapped[str] = mapped_column(String(15), default="PENDING")
    risk_score: Mapped[int] = mapped_column(Integer, default=0)
    account: Mapped[Account] = relationship()
    matches: Mapped[list["RuleMatch"]] = relationship(back_populates="transaction", cascade="all, delete-orphan")
    context: Mapped["TransactionContext | None"] = relationship(uselist=False, cascade="all, delete-orphan")
    alert: Mapped["Alert | None"] = relationship(back_populates="transaction", uselist=False)


Index("ix_tx_account_time", Transaction.account_id, Transaction.occurred_at)


class TransactionContext(Base):
    """Network telemetry captured with a transaction, plus any IP-enrichment supplied by an upstream provider.

    `source_ip` is observed telemetry. Every `geo_*`, `isp`, `asn`, `is_vpn` and `reputation` value is an
    *estimate* from `geo_provider`, nullable, and never filled in by this service. Personal data.
    """
    __tablename__ = "transaction_contexts"
    transaction_id: Mapped[str] = mapped_column(ForeignKey("transactions.id"), primary_key=True)
    source_ip: Mapped[str] = mapped_column(String(45), index=True)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    geo_country: Mapped[str | None] = mapped_column(String(2), nullable=True)
    geo_region: Mapped[str | None] = mapped_column(String(120), nullable=True)
    geo_county: Mapped[str | None] = mapped_column(String(120), nullable=True)
    geo_city: Mapped[str | None] = mapped_column(String(120), nullable=True)
    geo_la_code: Mapped[str | None] = mapped_column(String(9), nullable=True)
    geo_lat: Mapped[float | None] = mapped_column(nullable=True)
    geo_lon: Mapped[float | None] = mapped_column(nullable=True)
    geo_accuracy_km: Mapped[float | None] = mapped_column(nullable=True)
    geo_provider: Mapped[str | None] = mapped_column(String(80), nullable=True)
    geo_confidence: Mapped[str | None] = mapped_column(String(10), nullable=True)
    isp: Mapped[str | None] = mapped_column(String(160), nullable=True)
    asn: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_vpn: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    reputation: Mapped[str | None] = mapped_column(String(20), nullable=True)


class RiskRule(Base):
    __tablename__ = "risk_rules"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    code: Mapped[str] = mapped_column(String(60), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    kind: Mapped[str] = mapped_column(String(40))
    config: Mapped[dict] = mapped_column(JSON)
    weight: Mapped[int] = mapped_column(Integer)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class RuleMatch(Base):
    __tablename__ = "rule_matches"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    transaction_id: Mapped[str] = mapped_column(ForeignKey("transactions.id"), index=True)
    rule_id: Mapped[str] = mapped_column(ForeignKey("risk_rules.id"))
    rule_code: Mapped[str] = mapped_column(String(60))
    rule_version: Mapped[int] = mapped_column(Integer)
    rule_config_snapshot: Mapped[dict] = mapped_column(JSON)
    score: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    transaction: Mapped[Transaction] = relationship(back_populates="matches")
    __table_args__ = (UniqueConstraint("transaction_id", "rule_id", name="uq_tx_rule"),)


class Alert(Base):
    __tablename__ = "alerts"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    transaction_id: Mapped[str] = mapped_column(ForeignKey("transactions.id"), unique=True)
    status: Mapped[str] = mapped_column(String(20), default="OPEN")
    priority: Mapped[str] = mapped_column(String(10), default="MEDIUM")
    risk_score: Mapped[int] = mapped_column(Integer)
    assigned_to: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    disposition: Mapped[str | None] = mapped_column(String(20), nullable=True)
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    # Set when an analyst first takes the case (assigns it, starts review or escalates); null while untouched.
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # GBP loss established by the analyst when closing as confirmed suspicious. Never inferred.
    confirmed_loss: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    transaction: Mapped[Transaction] = relationship(back_populates="alert")
    assignee: Mapped[User | None] = relationship()

    @property
    def rule_codes(self) -> list[str]:
        """Rule codes that matched the transaction; the alert type shown in the queue."""
        return [m.rule_code for m in self.transaction.matches] if self.transaction else []


class Merchant(Base):
    """A counterparty name bound to a known website domain by an analyst (or the seed).

    Logos are only ever shown for rows here, never guessed from free-text payment references.
    A logo is a visual identifier; it says nothing about whether the merchant is legitimate.
    """
    __tablename__ = "merchants"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(160))
    normalized_name: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    domain: Mapped[str] = mapped_column(String(253))
    address: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    verified_by: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class RevokedToken(Base):
    """JWT ids invalidated by sign-out; rows can be pruned once expires_at has passed."""
    __tablename__ = "revoked_tokens"
    jti: Mapped[str] = mapped_column(String(36), primary_key=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class ExportJob(Base):
    """Asynchronous CSV export. The file lives in a private temp directory and is deleted after download or expiry."""
    __tablename__ = "export_jobs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(12), default="QUEUED")  # QUEUED RUNNING READY FAILED DOWNLOADED EXPIRED
    scope: Mapped[str] = mapped_column(String(12))
    filters: Mapped[dict] = mapped_column(JSON, default=dict)
    total: Mapped[int] = mapped_column(Integer, default=0)
    processed: Mapped[int] = mapped_column(Integer, default=0)
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    filename: Mapped[str | None] = mapped_column(String(120), nullable=True)
    error: Mapped[str | None] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class OutboxEvent(Base):
    __tablename__ = "outbox_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    event_type: Mapped[str] = mapped_column(String(60))
    aggregate_id: Mapped[str] = mapped_column(String(36))
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)


class AuditHead(Base):
    """One locked row serialises append-only hash-chain writes in PostgreSQL."""
    __tablename__ = "audit_head"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    last_hash: Mapped[str] = mapped_column(String(64), default="0" * 64)


class AuditEvent(Base):
    __tablename__ = "audit_events"
    seq: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id: Mapped[str] = mapped_column(String(36), unique=True, default=new_id)
    actor: Mapped[str] = mapped_column(String(255))
    action: Mapped[str] = mapped_column(String(100))
    entity_type: Mapped[str] = mapped_column(String(80))
    entity_id: Mapped[str] = mapped_column(String(100))
    before: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    after: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    previous_hash: Mapped[str] = mapped_column(String(64))
    entry_hash: Mapped[str] = mapped_column(String(64), unique=True)
