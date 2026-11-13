"""TrueLayer open-banking client (sandbox) and mapping into this app's transaction model.

Tokens are used for a single import and never stored. The client secret is read from
the environment and never logged or returned.
"""
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from urllib.parse import urlencode
import jwt
import httpx
from ..config import settings

SCOPES = "accounts transactions"
MOCK_PROVIDER = "uk-cs-mock"
TIMEOUT = httpx.Timeout(15.0)


class TrueLayerError(Exception):
    """Raised for configuration problems and upstream failures; message is safe to show."""


def require_sandbox_config() -> None:
    if not settings.truelayer_client_id or not settings.truelayer_client_secret:
        raise TrueLayerError("TrueLayer is not configured: set TRUELAYER_CLIENT_ID and TRUELAYER_CLIENT_SECRET")
    if not settings.truelayer_client_id.startswith("sandbox-"):
        raise TrueLayerError("Refusing to run: only sandbox- client IDs are supported by this integration")


def make_state(user_id: str) -> str:
    """Signed, short-lived CSRF state binding the redirect to the admin who started it."""
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": user_id, "purpose": "truelayer", "iat": now, "exp": now + timedelta(minutes=15)},
                      settings.jwt_secret, algorithm="HS256")


def verify_state(state: str, user_id: str) -> bool:
    try:
        claims = jwt.decode(state, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return False
    return claims.get("purpose") == "truelayer" and claims.get("sub") == user_id


def build_auth_url(user_id: str) -> str:
    require_sandbox_config()
    query = urlencode({"response_type": "code", "client_id": settings.truelayer_client_id, "scope": SCOPES,
                       "redirect_uri": settings.truelayer_redirect_uri, "providers": MOCK_PROVIDER,
                       "state": make_state(user_id)})
    return f"{settings.truelayer_auth_url}/?{query}"


def _check(response: httpx.Response, what: str) -> dict:
    if response.status_code >= 400:
        raise TrueLayerError(f"TrueLayer {what} failed ({response.status_code})")
    return response.json()


def exchange_code(code: str) -> str:
    require_sandbox_config()
    response = httpx.post(f"{settings.truelayer_auth_url}/connect/token", timeout=TIMEOUT, data={
        "grant_type": "authorization_code", "client_id": settings.truelayer_client_id,
        "client_secret": settings.truelayer_client_secret, "redirect_uri": settings.truelayer_redirect_uri, "code": code})
    return _check(response, "token exchange")["access_token"]


def _get(token: str, path: str, params: dict | None = None) -> list[dict]:
    response = httpx.get(f"{settings.truelayer_api_url}/data/v1{path}", params=params, timeout=TIMEOUT,
                         headers={"Authorization": f"Bearer {token}"})
    return _check(response, path.split("/")[-1])["results"]


def fetch_accounts(token: str) -> list[dict]:
    return _get(token, "/accounts")


def fetch_transactions(token: str, account_id: str) -> list[dict]:
    return _get(token, f"/accounts/{account_id}/transactions")


def map_account(raw: dict) -> dict:
    number = (raw.get("account_number") or {}).get("number") or raw["account_id"]
    return {"id": raw["account_id"], "account_number_masked": f"•••• {str(number)[-4:]}",
            "holder_name": (raw.get("display_name") or "TrueLayer account")[:120], "home_country": "GB"}


def map_transaction(raw: dict, account_id: str) -> dict | None:
    """Returns None for rows that cannot be screened (zero/invalid amount, missing time)."""
    try:
        amount = abs(Decimal(str(raw["amount"]))).quantize(Decimal("0.01"))
        occurred = datetime.fromisoformat(str(raw["timestamp"]).replace("Z", "+00:00"))
    except (KeyError, InvalidOperation, ValueError):
        return None
    if amount <= 0:
        return None
    if occurred.tzinfo is None:
        occurred = occurred.replace(tzinfo=timezone.utc)
    direction = "CREDIT" if raw.get("transaction_type") == "CREDIT" else "DEBIT"
    counterparty = raw.get("merchant_name") or raw.get("description") or "Unknown"
    return {"external_id": f"tl-{raw['transaction_id']}"[:100], "account_id": account_id, "amount": amount,
            "currency": str(raw.get("currency", "GBP"))[:3].upper(), "direction": direction,
            "counterparty": counterparty[:160],
            # Sandbox data has no destination country; domestic UK bank rows default to GB.
            "country": "GB", "occurred_at": occurred.astimezone(timezone.utc)}
