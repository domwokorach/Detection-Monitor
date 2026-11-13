"""Server-side Logo.dev brand search: merchant name -> candidate canonical domains.

Only a sanitised company name leaves this service. Account numbers, statements, PII and
transaction details are never part of a request. The secret key is read from settings, sent
only in the Authorization header, and is never logged or placed in an error message.
Results are *candidates*; a logo is a visual identifier, not proof a merchant is legitimate.
"""
import asyncio
import json
import logging
import re
import time
from typing import Protocol

import httpx
from pydantic import BaseModel

from ..config import settings

logger = logging.getLogger(__name__)

MAX_QUERY_LENGTH = 80
CACHE_PREFIX = "brandsearch:v1:"
COOLDOWN_KEY = "brandsearch:v1:cooldown"
# Name characters only: letters (incl. accents), digits, and a few business-name symbols.
_QUERY_ALLOWED = re.compile(r"^[\w .,&'’\-+!]+$", re.UNICODE)
_DOMAIN = re.compile(r"^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,24}|xn--[a-z0-9-]{2,59})$")
# Looks like an account number / sort code / card number: refuse rather than forward to a third party.
_LOOKS_FINANCIAL = re.compile(r"\d{6,}|\b\d{2}-\d{2}-\d{2}\b|\bGB\d{2}[A-Z]{4}", re.IGNORECASE)


class BrandSearchError(Exception):
    """Safe to show to the caller: never contains credentials or upstream bodies."""
    def __init__(self, message: str, status_code: int = 502, retry_after: int | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.retry_after = retry_after


class BrandCandidate(BaseModel):
    name: str
    domain: str
    logo_url: str


class BrandSearchResult(BaseModel):
    query: str
    candidates: list[BrandCandidate]
    cached: bool = False


class Cache(Protocol):
    def get(self, key: str) -> str | None: ...
    def set(self, key: str, value: str, ex: int) -> None: ...
    def ttl(self, key: str) -> int: ...


class RedisCache:
    """Fail-open Redis wrapper: a Redis outage degrades to uncached lookups, never to an error."""
    def __init__(self, url: str):
        import redis
        self._client = redis.Redis.from_url(url, socket_connect_timeout=0.4, socket_timeout=0.4)

    def get(self, key: str) -> str | None:
        try:
            raw = self._client.get(key)
            return raw.decode() if raw else None
        except Exception as exc:
            logger.warning("Brand cache read failed: %s", type(exc).__name__)
            return None

    def set(self, key: str, value: str, ex: int) -> None:
        try:
            self._client.set(key, value, ex=ex)
        except Exception as exc:
            logger.warning("Brand cache write failed: %s", type(exc).__name__)

    def ttl(self, key: str) -> int:
        try:
            return max(0, int(self._client.ttl(key)))
        except Exception:
            return 0


def normalize_query(raw: str) -> str:
    """Collapse whitespace and enforce a conservative allow-list. Raises ValueError when unusable."""
    query = " ".join(raw.split())
    if len(query) < 2 or len(query) > MAX_QUERY_LENGTH:
        raise ValueError(f"Query must be 2-{MAX_QUERY_LENGTH} characters")
    if not _QUERY_ALLOWED.match(query):
        raise ValueError("Query contains unsupported characters")
    if _LOOKS_FINANCIAL.search(query):
        raise ValueError("Query looks like an account or card reference and was not sent")
    return query


def clean_domain(value: object) -> str | None:
    """Return a lower-case registrable-looking hostname, or None. Rejects IPs, ports, paths, localhost."""
    if not isinstance(value, str):
        return None
    host = value.strip().lower().rstrip(".")
    if host.startswith("www."):
        host = host[4:]
    return host if _DOMAIN.match(host) else None


def logo_reference(domain: str) -> str:
    """Token-free reference; the browser builds the signed CDN URL with its publishable key."""
    return f"https://img.logo.dev/{domain}"


def normalize_results(payload: object, limit: int) -> list[BrandCandidate]:
    rows = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(rows, list):
        raise BrandSearchError("Unexpected response from brand search provider")
    out: list[BrandCandidate] = []
    seen: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            continue
        domain = clean_domain(row.get("domain"))
        name = row.get("name")
        if not domain or domain in seen or not isinstance(name, str) or not name.strip():
            continue
        seen.add(domain)
        out.append(BrandCandidate(name=name.strip()[:120], domain=domain, logo_url=logo_reference(domain)))
        if len(out) >= limit:
            break
    return out


class BrandSearchService:
    def __init__(self, *, api_key: str | None = None, base_url: str | None = None, cache: Cache | None = None,
                 client: httpx.AsyncClient | None = None, retries: int = 2, timeout: float = 4.0,
                 positive_ttl: int = 86_400, negative_ttl: int = 3_600, sleep=asyncio.sleep):
        self._api_key = settings.logo_dev_secret_key if api_key is None else api_key
        self._base_url = (base_url or settings.logo_dev_api_url).rstrip("/")
        self._cache = cache
        self._client = client
        self._retries = retries
        self._timeout = timeout
        self._positive_ttl = positive_ttl
        self._negative_ttl = negative_ttl
        self._sleep = sleep

    @property
    def configured(self) -> bool:
        return bool(self._api_key)

    async def search(self, raw_query: str, limit: int = 5) -> BrandSearchResult:
        try:
            query = normalize_query(raw_query)
        except ValueError as exc:
            raise BrandSearchError(str(exc), status_code=422) from None
        limit = max(1, min(limit, 10))
        cache_key = f"{CACHE_PREFIX}{limit}:{query.casefold()}"

        if self._cache:
            hit = self._cache.get(cache_key)
            if hit:
                try:
                    return BrandSearchResult(query=query, candidates=json.loads(hit), cached=True)
                except ValueError:
                    pass  # corrupt entry: fall through and refetch
        if not self._api_key:
            raise BrandSearchError("Brand search is not configured", status_code=503)
        if self._cache:
            remaining = self._cache.ttl(COOLDOWN_KEY)
            if remaining > 0:
                raise BrandSearchError("Brand search is rate limited; try again shortly", 429, retry_after=remaining)

        candidates = await self._fetch(query, limit)
        if self._cache:
            self._cache.set(cache_key, json.dumps([c.model_dump() for c in candidates]),
                            ex=self._positive_ttl if candidates else self._negative_ttl)
        return BrandSearchResult(query=query, candidates=candidates)

    async def _fetch(self, query: str, limit: int) -> list[BrandCandidate]:
        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(timeout=self._timeout)
        headers = {"Authorization": f"Bearer {self._api_key}", "Accept": "application/json"}
        params = {"q": query, "limit": limit, "method": "match"}
        try:
            for attempt in range(self._retries + 1):
                last = attempt == self._retries
                try:
                    response = await client.get(f"{self._base_url}/v2/search", params=params, headers=headers,
                                                timeout=self._timeout)
                except (httpx.TimeoutException, httpx.TransportError) as exc:
                    logger.warning("Brand search transport error: %s", type(exc).__name__)
                    if last:
                        raise BrandSearchError("Brand search timed out", 504) from None
                    await self._sleep(self._backoff(attempt))
                    continue
                if response.status_code == 200:
                    try:
                        return normalize_results(response.json(), limit)
                    except ValueError:
                        raise BrandSearchError("Unexpected response from brand search provider") from None
                if response.status_code == 429:
                    wait = self._reset_seconds(response)
                    self._enter_cooldown(wait)
                    raise BrandSearchError("Brand search is rate limited; try again shortly", 429, retry_after=wait)
                if response.status_code in (401, 402, 403):
                    # Operator problem (bad key / no credits); never retry, never echo the upstream body.
                    logger.error("Brand search provider rejected the request (HTTP %s)", response.status_code)
                    raise BrandSearchError("Brand search is unavailable", 503)
                if response.status_code >= 500 and not last:
                    await self._sleep(self._backoff(attempt))
                    continue
                logger.warning("Brand search failed (HTTP %s)", response.status_code)
                raise BrandSearchError("Brand search failed", 502)
            raise BrandSearchError("Brand search failed", 502)  # pragma: no cover
        finally:
            if owns_client:
                await client.aclose()

    @staticmethod
    def _backoff(attempt: int) -> float:
        return min(2.0, 0.25 * (2 ** attempt))

    @staticmethod
    def _reset_seconds(response: httpx.Response) -> int:
        for header in ("RateLimit-Reset", "Retry-After"):
            try:
                return max(1, min(120, int(float(response.headers[header]))))
            except (KeyError, ValueError):
                continue
        return 30

    def _enter_cooldown(self, seconds: int) -> None:
        if self._cache:
            self._cache.set(COOLDOWN_KEY, str(int(time.time())), ex=seconds)


_service: BrandSearchService | None = None


def get_brand_search() -> BrandSearchService:
    """FastAPI dependency. Overridable in tests via app.dependency_overrides."""
    global _service
    if _service is None:
        cache = RedisCache(settings.redis_url) if settings.notify_redis else None
        _service = BrandSearchService(cache=cache)
    return _service
