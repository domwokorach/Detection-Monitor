# Sentinel — Fraud Detection & Transaction Monitoring

A runnable, portfolio-ready banking transaction-monitoring **MVP**. It ingests synthetic transactions, screens them with configurable rules, creates risk alerts, supports analyst case review, and maintains a hash-linked audit trail.

> **Scope:** This is a demonstration system using fictional accounts and synthetic transactions. Detection policies are illustrative, not a substitute for an institution's fraud controls, sanctions screening, AML program, or statutory suspicious-activity reporting.

## Quick start

Requires **Docker Engine** and **Docker Compose v2**.

```bash
cp .env.example .env
# For anything beyond a private local demo, replace all example passwords/secrets in .env.
docker compose up --build
```

Open:

- **React analyst dashboard:** http://localhost:8080
- **FastAPI interactive API docs:** http://localhost:8000/docs
- **API health check:** http://localhost:8000/api/health

Demo sign-in:

| Role | Email | Default password |
|---|---|---|
| Administrator | `admin@demo.local` | `ChangeMe123!` |
| Analyst | `analyst@demo.local` | `ChangeMe123!` |

The default credentials are **development-only** and should never be used with real data or on a public deployment. The dashboard includes them only as a local demo convenience. You can change them in `.env` *before the initial seed*. The existing user hash is not automatically changed if the database has already been seeded.

PostgreSQL is persisted to a named Docker volume. Redis messages are intentionally ephemeral because the PostgreSQL outbox is the durable source of work.

## What it demonstrates

| Feature | Implementation |
|---|---|
| Event ingestion | Authenticated `POST /api/transactions`; Decimal monetary amounts; external-ID idempotency with payload conflict detection |
| Asynchronous processing | Outbox table committed atomically with transactions; parallel-safe `SELECT ... FOR UPDATE SKIP LOCKED` worker, retry budget and Redis wakeups |
| Configurable rules | Amount threshold, country watchlist, velocity count, cumulative outflow; schema validation, enable/disable, version conflict checks |
| Risk analytics | Scoring capped at 100, flagged rate, daily counts, pending job counts, alert severity |
| Analyst review | Claim a case, set In Review/Escalated/Closed, require evidence and disposition on closure, enforce assignee restrictions |
| Auditability | User and system actions in a SHA-256-linked append-only application log; verification endpoint; matched rule version/config/score snapshots |
| UI | Responsive React/TypeScript dashboard with overview, investigation queue, transaction simulator, policy editor, audit browser |
| Security | Argon2 password hashes, signed expiring JWTs, role-based API authorization, server-side case transition rules |
| Testing | 8 automated pytest tests exercising API, rule engine, worker, review, idempotency, role restrictions, and tamper detection |

### Architecture

```text
                       +---------------------------+
                       |     React analyst UI      |
                       |  Login / Alerts / Rules   |
                       +-------------+-------------+
                                     |
                               HTTPS / REST
                                     |
                       +-------------v-------------+
                       |        FastAPI API        |
                       |  Auth + validation + RBAC |
                       +-------------+-------------+
                                     |
                        single database transaction
                                     |
                       +-------------v-------------+
                       |         PostgreSQL        |
                       | transactions + outbox     |
                       | rules, alerts, audit      |
                       +-------------+-------------+
                                     ^
                            row locks / commits
                                     |
                       +-------------+-------------+
                       |   Screening worker        |
                       | event-time rule evaluation|
                       | scoring + audit writes    |
                       +-------------+-------------+
                                     ^
                                     |
                          Redis list wakeup signal
                                     ^
                                     |
                                FastAPI API
```

The API commits a `Transaction`, its `OutboxEvent`, and ingestion audit event in **one DB transaction**. An optional Redis `LPUSH` nudges the worker, but a failed or lost notification is harmless because the worker regularly polls the PostgreSQL outbox. The worker locks one event, evaluates enabled rules, writes matched-rule snapshots and any alert, appends screening audit events, marks the outbox event processed, and commits **atomically**. Repeated work on an already screened transaction creates no duplicate alert.

PostgreSQL row locking supports multiple workers. Invalid events are retried up to five times and subsequently marked terminal; failing transaction screenings are marked `FAILED` and audited. This is at-least-once event delivery with idempotent screening effects, not a claim of exactly-once messaging.

### Seeded detection policies

| Rule | Trigger | Weight |
|---|---|---:|
| `LARGE_AMOUNT` | Single transaction ≥ 10,000 in the transaction currency | 50 |
| `WATCHLIST_COUNTRY` | Country code in configured list (seed uses synthetic `ZZ`) | 65 |
| `HIGH_VELOCITY` | ≥ 3 outgoing transfers in 10 minutes on the same account/currency | 45 |
| `OUTFLOW_SPIKE` | Outgoing transfers total ≥ 15,000 in 60 minutes on the same account/currency | 35 |

The scores are added and capped at 100. The default alert threshold is **40** (configurable in `.env`). A score of at least 75 is High priority, 50–74 Medium, and 40–49 Low. A rule match stores its code, version, configuration snapshot, points, and explanation.

**Time-window semantics:** Windowed rules use the transaction's `occurred_at` and only compare transfers in the same currency, direction, and account. All already-ingested events in the qualifying event-time window are included, even if not yet screened. Late-arriving transfers do **not** automatically rescore previously screened transactions; batch replay/reconciliation would be needed in a production pipeline. Thresholds are **per currency**, not FX-normalized.

## Example workflow

1. Sign in as Administrator at `http://localhost:8080`.
2. Examine the overview; sample transactions and screening events are seeded on first startup and the worker will populate alerts shortly afterward.
3. Select **Transactions → Simulate transaction**. Submit a GBP 12,500 debit (this exceeds the seeded amount rule).
4. Use the **Refresh** icon if the background worker has not completed screening yet. The UI also refreshes data automatically every 15 seconds.
5. Open the new case under **Alert queue**. Review matched rules, claim the case, choose **In review**, and record findings.
6. Close the case with a **Suspicious** or **False positive** disposition and a written note of at least 10 characters.
7. Go to **Risk rules** to edit a threshold or disable a rule. Versioned edits do not alter historical match snapshots.
8. Open **Audit history**, then select **Verify audit chain** while signed in as an administrator.

## API usage

Obtain an access token:

```bash
curl -s http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@demo.local","password":"ChangeMe123!"}'
```

Copy the `access_token` value from the JSON response into the command below:

```bash
TOKEN='PASTE_ACCESS_TOKEN_HERE'
curl -X POST http://localhost:8000/api/transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "external_id": "DEMO-PAYMENT-1001",
    "account_id": "acct-retail-01",
    "amount": "12500.00",
    "currency": "GBP",
    "direction": "DEBIT",
    "counterparty": "Example Vendor",
    "country": "GB",
    "occurred_at": "2026-11-13T09:45:00Z"
  }'
```

Replace `occurred_at` with the actual UTC payment timestamp when experimenting with sliding-window rules. Repeating an identical `external_id` and payload returns the existing record with HTTP 200; reusing the ID for different data returns HTTP 409.

### Key endpoints

| Endpoint | Access | Purpose |
|---|---|---|
| `POST /api/auth/login` | Public | Obtain an expiring JWT |
| `GET /api/me` | Authenticated | Current user and role |
| `GET /api/overview` | Authenticated | KPI counts and rates |
| `GET /api/analytics/daily?days=7` | Authenticated | Daily volume and flagged counts |
| `GET /api/accounts` | Authenticated | Demo accounts |
| `POST /api/transactions` | Authenticated | Idempotent transaction ingestion |
| `GET /api/transactions` | Authenticated | Transaction stream |
| `GET /api/transactions/{id}` | Authenticated | Transaction with historical rule matches |
| `GET /api/alerts` | Authenticated | Filtered alert queue |
| `GET /api/alerts/{id}` | Authenticated | Case and matching rules |
| `PATCH /api/alerts/{id}` | Authenticated | Assign, escalate, resolve with evidence |
| `GET /api/rules` | Authenticated | Configured policies |
| `POST /api/rules` | Administrator | Add a policy |
| `PATCH /api/rules/{id}` | Administrator | Version-checked policy change |
| `GET /api/audit` | Authenticated | Recent audit events |
| `GET /api/audit/verify` | Administrator | Check audit hash-chain integrity |

The API is documented at `/docs` using OpenAPI.

## Merchant logos (Logo.dev)

- `VITE_LOGO_DEV_PUBLISHABLE_KEY` (`pk_…`, `frontend/.env.local`) builds `img.logo.dev` image URLs in the browser.
- `LOGO_DEV_SECRET_KEY` (`sk_…`, root `.env`) is used only by the API for `GET /api/brands/search` (Logo.dev `/v2/search`; Redis-cached, retried, rate-limit aware). It is never sent to the frontend.
- Logos show only for analyst-verified counterparty → domain bindings (`/api/merchants`); search results are suggestions an analyst must confirm. Logos are visual identifiers, not evidence of legitimacy.
- Free Community plan in production: Logo.dev requires a visible "Logos provided by Logo.dev" link.

## Running automated tests

With Python 3.12+ and a working package registry:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
python -m pytest -q
```

Tests use isolated SQLite databases and replace Redis notifications with an in-memory stub. They test business logic and API behavior without requiring running PostgreSQL or Redis. PostgreSQL concurrency, Compose startup and browser functionality should also be verified in an integration environment.

## Local frontend development

```bash
# terminal 1: start the Docker services
# terminal 2:
cd frontend
npm install
npm run dev
# http://localhost:5173
```

Vite proxies `/api` to `http://localhost:8000` in development. Production Nginx proxies `/api` to the API container and serves the compiled SPA.

## Project structure

```text
fraud-monitor/
├── compose.yaml
├── .env.example
├── backend/
│   ├── app/
│   │   ├── api.py              # REST endpoints, case management, rule CRUD
│   │   ├── models.py           # SQLAlchemy domain and outbox models
│   │   ├── schemas.py          # API contracts and input validation
│   │   ├── security.py         # Argon2 password hashes + JWTs + RBAC
│   │   ├── seed.py             # Synthetic accounts / rules / events
│   │   ├── worker.py           # Continuous outbox processor
│   │   └── services/
│   │       ├── rules.py        # Detection engine
│   │       ├── screening.py    # Atomic processing and retries
│   │       └── audit.py        # Audit hash chain and verification
│   └── tests/
│       ├── conftest.py
│       └── test_monitoring.py
└── frontend/
    ├── nginx.conf
    └── src/
        ├── App.tsx             # Dashboard, tables, editors, drawers
        ├── api.ts             # Typed authenticated client
        ├── types.ts           # Domain types
        └── styles.css         # Responsive interface
```

## Production-hardening backlog

This is a learning/portfolio **MVP**, not a certified production AML or fraud platform. Production deployments would additionally need:

- **Authentication/authorization:** SSO/MFA, service identities for bank integrations, separate ingestion credentials, CSRF/CSP/XSS mitigations, JWT rotation/revocation, rate limiting, and user lifecycle management. Current JWTs are held in React memory (not localStorage) and are intentionally lost on a reload.
- **Data security:** TLS, KMS-backed encryption, tokenization of customer data, strict access logging, secrets manager, network segmentation, retention/deletion policies and least-privilege DB permissions.
- **Persistence and schema evolution:** Versioned Alembic migrations, connection limits, partitioned tables, backup/restore testing, and migration-safe rollout (the MVP uses `create_all` on API startup).
- **Compliance and data quality:** Jurisdiction-specific policies and controlled watchlists, validated sanctions/PEP screening from maintained external datasets, customer identity/beneficial owner context, SAR/STR workflows, case approvals, and regulatory retention. The synthetic `ZZ` watchlist has no real-world compliance significance.
- **Risk accuracy:** FX-normalized thresholds, account baselines, late-arrival reconciliation/rescreening, event ordering, false-positive metrics, entity linkage and machine-learning augmentation with model governance.
- **Operational observability:** Metrics, queue-lag SLOs, alert delivery notifications, distributed tracing, dead-letter queue management, replay tools, integration tests against PostgreSQL, and web end-to-end tests.
- **Audit durability:** Write-once external retention or signed audit exports. A SHA-256 chain in a mutable database detects many modifications but does not protect against a privileged attacker rewriting the entire chain and head.

## Implementation notes

- Amounts are validated as `Decimal` and stored as PostgreSQL `NUMERIC(18,2)`.
- The worker uses DB-level locking; the Redis queue is only a low-latency hint and need not be durable.
- The UI loads a maximum of 500 transactions and alerts per view. This is intentionally simple; true pagination/aggregation should happen in PostgreSQL for large datasets.
- Case status transitions are validated on the backend. Closed cases cannot be reopened through this MVP API, and final closure requires a disposition and explanatory note.
- Demo accounts and transaction IDs are fictional. No production bank credentials, personal data, or payment networks are included.
