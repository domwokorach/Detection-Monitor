import asyncio
import json
import logging

import httpx
import pytest
from sqlalchemy import select

from app.main import app
from app.models import AuditEvent
from app.services.audit import verify_chain
from app.services.brand_search import (
    COOLDOWN_KEY, BrandSearchError, BrandSearchService, clean_domain, get_brand_search, normalize_query,
)
from app.services.merchants import normalize_name

SECRET = "sk_test_super_secret_value"


class MemoryCache:
    def __init__(self):
        self.data: dict[str, str] = {}
        self.expiry: dict[str, int] = {}

    def get(self, key):
        return self.data.get(key)

    def set(self, key, value, ex):
        self.data[key], self.expiry[key] = value, ex

    def ttl(self, key):
        return self.expiry.get(key, 0) if key in self.data else 0


def payload(*rows):
    return {"data": [{"object": "search_result", "name": n, "domain": d, "logo_url": f"https://img.logo.dev/{d}?token=pk"}
                     for n, d in rows], "metadata": {"request_id": "r1"}}


def make_service(handler, cache=None, **kw):
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    sleeps: list[float] = []

    async def fake_sleep(seconds):
        sleeps.append(seconds)
    service = BrandSearchService(api_key=SECRET, base_url="https://api.test", cache=cache, client=client,
                                 sleep=fake_sleep, **kw)
    return service, sleeps


def run(coro):
    return asyncio.run(coro)


# ---- pure helpers -------------------------------------------------------------------------------

@pytest.mark.parametrize("raw,ok", [
    ("Barclays", True), ("  Marks   & Spencer ", True), ("Café Nero", True),
    ("x", False), ("a" * 81, False), ("<script>", False), ("evil.com/path?x=1", False),
    ("12345678", False), ("20-00-00 Barclays", False), ("GB29NWBK60161331926819", False),
])
def test_normalize_query(raw, ok):
    if ok:
        assert normalize_query(raw)
    else:
        with pytest.raises(ValueError):
            normalize_query(raw)


@pytest.mark.parametrize("raw,expected", [
    ("Barclays.co.uk", "barclays.co.uk"), ("www.tesco.com", "tesco.com"), ("tesco.com.", "tesco.com"),
    ("bücher.de", None), ("xn--bcher-kva.de", "xn--bcher-kva.de"),
    ("https://x.com", None), ("x.com/path", None), ("localhost", None), ("127.0.0.1", None),
    ("a.b", None), ("exa mple.com", None), ("user@x.com", None), ("x.com:8080", None), (None, None), (5, None),
])
def test_clean_domain(raw, expected):
    assert clean_domain(raw) == expected


def test_normalize_name_is_case_and_punctuation_insensitive():
    assert normalize_name("  M&S  Food-Hall ") == "m s food hall"
    assert normalize_name("TESCO") == normalize_name("tesco")


# ---- service ------------------------------------------------------------------------------------

def test_search_normalises_results_and_sends_only_the_name():
    seen = {}

    def handler(request: httpx.Request):
        seen["auth"] = request.headers["authorization"]
        seen["params"] = dict(request.url.params)
        return httpx.Response(200, json=payload(("Barclays", "barclays.co.uk"), ("Bad", "http://evil"), ("Barclays", "www.barclays.co.uk"),
                                                ("", "empty.com"), ("Barclays Bank", "barclays.com")))

    service, _ = make_service(handler)
    result = run(service.search("  Barclays "))
    assert [c.domain for c in result.candidates] == ["barclays.co.uk", "barclays.com"]
    assert result.candidates[0].logo_url == "https://img.logo.dev/barclays.co.uk"  # token-free reference
    assert seen["auth"] == f"Bearer {SECRET}"
    assert seen["params"] == {"q": "Barclays", "limit": "5", "method": "match"}


def test_results_are_cached_including_misses():
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(200, json=payload(("Tesco", "tesco.com")) if "tesco" in request.url.params["q"].lower() else payload())

    cache = MemoryCache()
    service, _ = make_service(handler, cache=cache)
    assert run(service.search("Tesco")).cached is False
    assert run(service.search("TESCO")).cached is True
    run(service.search("Nope Nope"))
    assert run(service.search("nope nope")).candidates == []
    assert len(calls) == 2
    ttls = {k: v for k, v in cache.expiry.items() if k != COOLDOWN_KEY}
    assert sorted(ttls.values()) == [3_600, 86_400]  # shorter negative caching


def test_retries_server_errors_then_succeeds():
    attempts = []

    def handler(request):
        attempts.append(1)
        return httpx.Response(503) if len(attempts) < 3 else httpx.Response(200, json=payload(("Tesco", "tesco.com")))

    service, sleeps = make_service(handler)
    assert run(service.search("Tesco")).candidates[0].domain == "tesco.com"
    assert len(attempts) == 3 and sleeps == [0.25, 0.5]


def test_timeouts_exhaust_retries_with_safe_error():
    def handler(request):
        raise httpx.ConnectTimeout("boom", request=request)

    service, _ = make_service(handler)
    with pytest.raises(BrandSearchError) as err:
        run(service.search("Tesco"))
    assert err.value.status_code == 504 and SECRET not in str(err.value)


def test_rate_limit_sets_cooldown_and_blocks_further_calls():
    calls = []

    def handler(request):
        calls.append(1)
        return httpx.Response(429, headers={"RateLimit-Remaining": "0", "RateLimit-Reset": "42"})

    cache = MemoryCache()
    service, _ = make_service(handler, cache=cache)
    with pytest.raises(BrandSearchError) as first:
        run(service.search("Tesco"))
    assert first.value.status_code == 429 and first.value.retry_after == 42
    with pytest.raises(BrandSearchError) as second:
        run(service.search("Barclays"))
    assert second.value.status_code == 429 and second.value.retry_after == 42
    assert len(calls) == 1  # the cooldown prevented a second upstream call


@pytest.mark.parametrize("status", [401, 402, 403])
def test_credential_and_credit_errors_are_not_retried_or_leaked(status, caplog):
    calls = []

    def handler(request):
        calls.append(1)
        return httpx.Response(status, json={"error": {"message": f"bad key {SECRET}"}})

    service, _ = make_service(handler)
    with caplog.at_level(logging.DEBUG):
        with pytest.raises(BrandSearchError) as err:
            run(service.search("Tesco"))
    assert err.value.status_code == 503 and len(calls) == 1
    assert SECRET not in str(err.value) and SECRET not in caplog.text


def test_malformed_payload_is_a_safe_failure():
    service, _ = make_service(lambda request: httpx.Response(200, json={"nope": 1}))
    with pytest.raises(BrandSearchError):
        run(service.search("Tesco"))
    service, _ = make_service(lambda request: httpx.Response(200, content=b"<html>"))
    with pytest.raises(BrandSearchError):
        run(service.search("Tesco"))


def test_invalid_query_never_reaches_the_network():
    def handler(request):
        raise AssertionError("must not be called")

    service, _ = make_service(handler)
    with pytest.raises(BrandSearchError) as err:
        run(service.search("GB29NWBK60161331926819"))
    assert err.value.status_code == 422


def test_unconfigured_key_is_reported_without_a_call():
    service = BrandSearchService(api_key="", cache=None)
    with pytest.raises(BrandSearchError) as err:
        run(service.search("Tesco"))
    assert err.value.status_code == 503


# ---- HTTP integration ---------------------------------------------------------------------------

@pytest.fixture
def brand_client(system):
    client, maker, headers = system
    service, _ = make_service(lambda r: httpx.Response(200, json=payload(("Tesco", "tesco.com"))), cache=MemoryCache())
    app.dependency_overrides[get_brand_search] = lambda: service
    yield client, maker, headers
    app.dependency_overrides.pop(get_brand_search, None)


def test_brand_search_endpoint_requires_auth_and_validates(brand_client):
    client, _, headers = brand_client
    assert client.get("/api/brands/search", params={"q": "Tesco"}).status_code == 401
    ok = client.get("/api/brands/search", params={"q": "Tesco"}, headers=headers)
    assert ok.status_code == 200
    assert ok.json()["candidates"] == [{"name": "Tesco", "domain": "tesco.com", "logo_url": "https://img.logo.dev/tesco.com"}]
    assert client.get("/api/brands/search", params={"q": "12345678"}, headers=headers).status_code == 422
    assert client.get("/api/brands/search", headers=headers).status_code == 422
    assert SECRET not in ok.text


def test_brand_search_endpoint_maps_rate_limit_to_429_with_retry_after(system):
    client, _, headers = system
    service, _ = make_service(lambda r: httpx.Response(429, headers={"RateLimit-Reset": "7"}), cache=MemoryCache())
    app.dependency_overrides[get_brand_search] = lambda: service
    try:
        res = client.get("/api/brands/search", params={"q": "Tesco"}, headers=headers)
    finally:
        app.dependency_overrides.pop(get_brand_search, None)
    assert res.status_code == 429 and res.headers["retry-after"] == "7"


def test_merchant_verification_flow_is_validated_audited_and_unique(system):
    client, maker, headers = system
    seeded = {m["name"]: m["domain"] for m in client.get("/api/merchants", headers=headers).json()}
    assert seeded["Tesco"] == "tesco.com"

    bad = client.post("/api/merchants", json={"name": "Acme Ltd", "domain": "https://evil.example/x"}, headers=headers)
    assert bad.status_code == 422
    created = client.post("/api/merchants", json={"name": "Acme  Ltd", "domain": "WWW.Acme.co.uk"}, headers=headers)
    assert created.status_code == 201 and created.json()["domain"] == "acme.co.uk"
    assert created.json()["normalized_name"] == "acme ltd" and created.json()["verified_by"] == "admin@demo.local"
    assert client.post("/api/merchants", json={"name": "acme ltd", "domain": "other.com"}, headers=headers).status_code == 409
    assert client.get("/api/merchants").status_code == 401
    with maker() as db:
        actions = [e.action for e in db.scalars(select(AuditEvent)).all()]
        assert actions.count("MERCHANT_VERIFIED") == 1
        assert verify_chain(db)["valid"]


def test_alerts_expose_rule_codes_as_alert_type(system):
    from app.services.screening import drain
    client, maker, headers = system
    with maker() as db:
        drain(db, limit=200)
    alerts = client.get("/api/alerts", headers=headers).json()
    assert alerts and all(isinstance(a["rule_codes"], list) for a in alerts)
    assert any("LARGE_AMOUNT" in a["rule_codes"] for a in alerts)
    assert json.dumps(alerts)  # serialisable
