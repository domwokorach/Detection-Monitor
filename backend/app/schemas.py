from datetime import datetime, timezone
from decimal import Decimal
from typing import Literal
import ipaddress
from pydantic import BaseModel, Field, ConfigDict, field_validator


class ApiModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class LoginIn(BaseModel):
    email: str
    password: str


class UserOut(ApiModel):
    id: str
    email: str
    display_name: str
    role: str


class AccountOut(ApiModel):
    id: str
    account_number_masked: str
    holder_name: str
    home_country: str
    la_code: str | None = None


class TransactionContextIn(BaseModel):
    """Optional telemetry from the payment channel. Enrichment fields are provider estimates; omit what is unknown."""
    source_ip: str = Field(max_length=45)
    geo_country: str | None = Field(default=None, min_length=2, max_length=2)
    geo_region: str | None = Field(default=None, max_length=120)
    geo_county: str | None = Field(default=None, max_length=120)
    geo_city: str | None = Field(default=None, max_length=120)
    geo_la_code: str | None = Field(default=None, max_length=9)
    geo_lat: float | None = Field(default=None, ge=-90, le=90)
    geo_lon: float | None = Field(default=None, ge=-180, le=180)
    geo_accuracy_km: float | None = Field(default=None, ge=0, le=20000)
    geo_provider: str | None = Field(default=None, max_length=80)
    geo_confidence: Literal["low", "medium", "high"] | None = None
    isp: str | None = Field(default=None, max_length=160)
    asn: str | None = Field(default=None, max_length=20)
    is_vpn: bool | None = None
    reputation: Literal["clean", "suspicious", "malicious"] | None = None

    @field_validator("source_ip")
    @classmethod
    def valid_ip(cls, value: str) -> str:
        try:
            return str(ipaddress.ip_address(value.strip()))
        except ValueError:
            raise ValueError("source_ip must be a valid IPv4 or IPv6 address")

    @field_validator("geo_country")
    @classmethod
    def upper_country(cls, value: str | None) -> str | None:
        return value.upper() if value else value


class TransactionIn(BaseModel):
    external_id: str = Field(min_length=3, max_length=100)
    account_id: str
    amount: Decimal = Field(gt=0, max_digits=18, decimal_places=2)
    currency: str = Field(min_length=3, max_length=3)
    direction: Literal["DEBIT", "CREDIT"] = "DEBIT"
    counterparty: str = Field(min_length=1, max_length=160)
    country: str = Field(min_length=2, max_length=2)
    occurred_at: datetime
    context: TransactionContextIn | None = None

    @field_validator("country", "currency")
    @classmethod
    def upper_code(cls, value: str) -> str:
        if not value.isalpha():
            raise ValueError("Must contain letters only")
        return value.upper()

    @field_validator("occurred_at")
    @classmethod
    def aware(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("Timezone offset required")
        return value.astimezone(timezone.utc)


class TransactionOut(ApiModel):
    id: str
    external_id: str
    account_id: str
    amount: Decimal
    currency: str
    direction: str
    counterparty: str
    country: str
    occurred_at: datetime
    screening_status: str
    risk_score: int


class MatchOut(ApiModel):
    id: str
    rule_code: str
    rule_version: int
    rule_config_snapshot: dict
    score: int
    reason: str


class TransactionDetail(TransactionOut):
    matches: list[MatchOut] = []


class AlertOut(ApiModel):
    id: str
    rule_codes: list[str] = []
    transaction_id: str
    status: str
    priority: str
    risk_score: int
    assigned_to: str | None
    disposition: str | None
    review_note: str | None
    created_at: datetime
    updated_at: datetime
    transaction: TransactionOut


class AlertDetail(AlertOut):
    matches: list[MatchOut] = []


class AlertReview(BaseModel):
    status: Literal["OPEN", "IN_REVIEW", "ESCALATED", "CLOSED"]
    disposition: Literal["SUSPICIOUS", "FALSE_POSITIVE"] | None = None
    note: str | None = Field(default=None, max_length=3000)
    assign_to_me: bool = False
    # GBP loss established on closing a case as confirmed suspicious.
    confirmed_loss: Decimal | None = Field(default=None, ge=0, max_digits=18, decimal_places=2)


class RuleIn(BaseModel):
    code: str = Field(pattern=r"^[A-Z][A-Z0-9_]{2,59}$")
    name: str = Field(min_length=3, max_length=120)
    description: str = Field(default="", max_length=1000)
    kind: Literal["AMOUNT_THRESHOLD", "COUNTRY_WATCHLIST", "VELOCITY", "CUMULATIVE_AMOUNT"]
    config: dict
    weight: int = Field(ge=1, le=100)
    enabled: bool = True


class RuleUpdate(BaseModel):
    expected_version: int = Field(ge=1)
    name: str | None = Field(default=None, min_length=3, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    config: dict | None = None
    weight: int | None = Field(default=None, ge=1, le=100)
    enabled: bool | None = None


class RuleOut(ApiModel):
    id: str
    code: str
    name: str
    description: str
    kind: str
    config: dict
    weight: int
    enabled: bool
    version: int
    updated_at: datetime


class AuditOut(ApiModel):
    seq: int
    id: str
    actor: str
    action: str
    entity_type: str
    entity_id: str
    before: dict | None
    after: dict | None
    created_at: datetime
    previous_hash: str
    entry_hash: str


class MerchantOut(ApiModel):
    id: str
    name: str
    normalized_name: str
    domain: str
    verified_by: str
    created_at: datetime


class MerchantIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    domain: str = Field(min_length=4, max_length=253)


class BrandCandidateOut(BaseModel):
    name: str
    domain: str
    logo_url: str


class BrandSearchOut(BaseModel):
    query: str
    candidates: list[BrandCandidateOut]
    cached: bool = False
