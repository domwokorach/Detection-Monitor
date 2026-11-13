# Security Policy

This document describes the security controls that exist in Detection Monitor, their known limits, and how to report a vulnerability. It describes the code in this repository; it is **not** a security certification or audit report.

> Detection Monitor is a portfolio-grade MVP running on synthetic data. It has not been independently penetration-tested and must not process real customer or payment data without the hardening listed in [RISK.md](RISK.md) and the [deployment checklist](#deployment-security-checklist) below.

## Contents

- [Supported versions](#supported-versions)
- [Reporting vulnerabilities](#reporting-vulnerabilities)
- [Responsible disclosure](#responsible-disclosure)
- [Authentication](#authentication)
- [Authorisation and role-based access control](#authorisation-and-role-based-access-control)
- [API key handling and secret management](#api-key-handling-and-secret-management)
- [Database security](#database-security)
- [Audit logging](#audit-logging)
- [Protection of financial information](#protection-of-financial-information)
- [Data encryption recommendations](#data-encryption-recommendations)
- [Dependency and vulnerability management](#dependency-and-vulnerability-management)
- [Known limitations](#known-limitations)
- [Deployment security checklist](#deployment-security-checklist)

## Supported versions

| Version | Supported |
|---|---|
| `main` branch (API version 1.0.0) | Yes, best effort |
| Any other branch, fork or tag | No |

There are no tagged releases and no formal support commitment. Fixes land on `main`.

## Reporting vulnerabilities

Please **do not** open a public issue for a suspected vulnerability.

| Channel | Detail |
|---|---|
| Email | `security@example.invalid` **(PLACEHOLDER: requires configuration by the project owner)** |
| GitHub | Use *private vulnerability reporting* under the repository's Security tab once the owner enables it **(requires configuration)** |

Include: affected component and file, steps to reproduce, impact, and any proof of concept. Do **not** include real personal or financial data, and do not attach live credentials.

Target response times are goals, not guarantees: acknowledgement within 5 working days, assessment within 15 working days. These are **illustrative** until an owner commits to them.

## Responsible disclosure

- Give the maintainer reasonable time to investigate and fix before publishing details.
- Test only against your own local deployment. Do not test against systems you do not own, and do not access, modify or exfiltrate data that is not yours.
- Do not run denial-of-service, social-engineering or physical attacks.
- Good-faith research that follows these rules will not be treated as hostile by the maintainer. This is not legal advice and does not bind any third party.

No bug-bounty programme exists.

## Authentication

Implemented in `backend/app/security.py`:

- Passwords are hashed with **Argon2** (`argon2-cffi` defaults).
- Access tokens are **JWTs signed with HS256** using `JWT_SECRET`. They carry subject, role, issued-at, a unique `jti` and an expiry (default 480 minutes, `JWT_TTL_MINUTES`).
- **Sign-out revokes the token server-side**: its `jti` is stored in `revoked_tokens` until expiry and expired entries are purged.
- Tokens are held in front-end memory, not `localStorage`, so a page reload signs the user out.
- Missing, malformed, expired or revoked tokens return `401`.

Not implemented: multi-factor authentication, SSO, account lockout, password-complexity policy, key rotation, refresh tokens and login rate limiting. Treat these as required before any real deployment.

## Authorisation and role-based access control

Authorisation is enforced **on the server** in FastAPI dependencies; hiding a menu item in the UI is never relied upon.

| Role | Capabilities |
|---|---|
| `analyst` | Read overview, transactions, alerts, rules, audit; claim and review alerts; export investigations (if listed in `EXPORT_ROLES`); verify merchants. Personal data is **masked** |
| `admin` | Everything an analyst can do, plus create/update rules, verify the audit chain, run the TrueLayer sandbox import, act on cases assigned to others, and view **unmasked** IP addresses and customer addresses |

Further server-side rules:

- A case assigned to one analyst cannot be modified by another analyst (admins may).
- Closed cases are immutable.
- Status transitions are validated server-side; closure requires a disposition and a note.
- Investigation exports are limited by `EXPORT_ROLES` (default `admin,analyst`); denied attempts are audited as `INVESTIGATIONS_EXPORT_DENIED`.
- Export jobs are visible only to their owner (other users get `404`, not `403`).

Roles are stored as a string on the user record. There is no user-management UI or API; users are created by the demo seed. Least-privilege, joiner/mover/leaver processes and periodic access review remain an operator responsibility ([POLICY.md](POLICY.md)).

## API key handling and secret management

| Secret | Where it lives | Rule |
|---|---|---|
| `JWT_SECRET` | Backend environment | At least 32 random bytes; never the example value outside local development |
| `POSTGRES_PASSWORD` | Environment / secrets manager | Replace the example value |
| `TRUELAYER_CLIENT_SECRET` | Backend environment only | Sandbox only in this repository |
| `LOGO_DEV_SECRET_KEY` (`sk_…`) | Backend environment only | **Never** prefix with `VITE_`; read only by the API |
| `VITE_LOGO_DEV_PUBLISHABLE_KEY` (`pk_…`) | Front-end build | Public by design; it ships in the browser bundle |

Practices in this repository: `.env` is git-ignored; `.env.example` contains placeholders and development-only values; the TrueLayer secret is blank in `.env.example`; TrueLayer access tokens exist only for the duration of one import request; the OAuth `state` is verified against the calling admin.

Recommended: use a secrets manager (cloud KMS-backed or equivalent) instead of `.env` files, rotate any secret that has ever been committed or shared, and run secret scanning in CI.

## Database security

- All access goes through SQLAlchemy ORM and parameterised queries. `LIKE` filters escape wildcard characters.
- Monetary amounts are `NUMERIC(18,2)`; transaction ingestion is idempotent on `external_id` with payload-conflict detection.
- The Compose database is reachable only on the internal Docker network (no published port). Do not publish it.
- Schema creation uses `create_all` plus small additive `ALTER TABLE` statements at start-up. **There are no versioned migrations.** Adopt Alembic for managed deployments.
- The application connects as a single role. Production should use separate least-privilege roles (the application role should not own the schema, and ideally have no `UPDATE`/`DELETE` on `audit_events`).
- Redis persistence is disabled in Compose and holds no durable state.

## Audit logging

Security-relevant actions are appended to `audit_events` as a chain: each entry stores the previous entry's hash, and its own SHA-256 is computed over a canonical JSON form of its fields. A single `audit_head` row (locked on write) holds the latest hash.

Logged actions include ingestion, screening, alert creation, case review, evidence review, rule creation and update, merchant verification, investigation exports (requested, completed, downloaded, denied) and administrator views of personal data (de-duplicated to one entry per alert per 10 minutes).

`GET /api/audit/verify` (admin only) recomputes the whole chain and reports the first broken position.

**Limits.** A hash chain stored in the same database detects edits to individual entries. It does **not** prevent a privileged database user from deleting history or rewriting every entry and the head hash. For stronger guarantees, export signed audit snapshots to write-once storage and restrict database privileges. Audit entries record who did what; they do not record read access for non-admin users.

## Protection of financial information

- Account numbers are stored masked (for example `•••• 1042`). The system does not store card numbers or full account numbers in the demo.
- Personal data in the investigation workspace and CSV exports (IP address, customer address, postcode) is **masked server-side** unless the caller is an admin; unmasked views are audited.
- CSV exports neutralise spreadsheet formula injection (cells beginning `=`, `+`, `-`, `@`, tab or carriage return are prefixed), are built from a consistent database snapshot, and are **audited before delivery** (the file is not released if the audit write fails).
- Large exports run as background jobs written to a `0600` temporary file, are single-use, owner-only, expire (default 900 s) and are securely deleted after download.
- Geolocation shown to analysts is labelled as an inferred estimate, never as verified location.
- The system relies on the operator for network-level protection: it sets no CSP, HSTS or rate limits itself (see below).

## Data encryption recommendations

| Layer | Recommendation | Status in this repository |
|---|---|---|
| In transit | TLS 1.2+ at a reverse proxy or load balancer in front of Nginx and the API | **Not configured**: Compose serves plain HTTP for local use |
| At rest (database) | Encrypted volumes or managed-database encryption, KMS-managed keys | Not configured |
| At rest (exports) | Encrypted temp storage; short TTL | Files are `0600` and short-lived, but not encrypted |
| Secrets | Secrets manager, not files | `.env` for local development |
| Field level | Tokenise or encrypt customer identifiers before real use | Not implemented |
| Backups | Encrypted, access-controlled, restore-tested | Not configured |

## Dependency and vulnerability management

- Back-end dependencies are bounded by major version in `backend/requirements.txt`; front-end dependencies are locked by `package-lock.json`.
- There is no automated scanning configured in this repository. Recommended: enable Dependabot or Renovate, run `pip-audit` and `npm audit` in CI, scan container images, pin base images by digest, and review changes to lock files.
- Front-end packages are released frequently; review upgrades rather than accepting them blindly.

## Known limitations

Already stated above and in [RISK.md](RISK.md): no MFA/SSO, no rate limiting, no CSRF/CSP/HSTS headers set by the application, HS256 symmetric signing with a single secret, no key rotation, no versioned migrations, mutable-database audit chain, CORS limited to a single configured origin, demonstration credentials in `.env.example`.

## Deployment security checklist

- [ ] Replace `JWT_SECRET`, `POSTGRES_PASSWORD` and both demo passwords; or remove demo users and `SEED_DEMO`.
- [ ] Terminate TLS in front of the application; redirect HTTP to HTTPS; add HSTS.
- [ ] Add security headers (CSP, `X-Content-Type-Options`, `Referrer-Policy`, frame protection) at the proxy.
- [ ] Add login and API rate limiting and account lockout.
- [ ] Add MFA or SSO; define a user-lifecycle process.
- [ ] Set `CORS_ORIGIN` to the exact production origin.
- [ ] Do not publish PostgreSQL or Redis ports; restrict network access.
- [ ] Use least-privilege database roles; adopt versioned migrations.
- [ ] Move secrets to a secrets manager; scan the repository history for leaked secrets.
- [ ] Enable encrypted storage and tested backups.
- [ ] Ship audit events to write-once storage and alert on `GET /api/audit/verify` failures.
- [ ] Set `EXPORT_ROLES` to the minimum needed and place `EXPORT_DIR` on encrypted storage.
- [ ] Use only TrueLayer **production** credentials under a proper agreement, or leave the integration unconfigured.
- [ ] Enable dependency, container and secret scanning in CI.
- [ ] Rehearse the incident process in [POLICY.md](POLICY.md#incident-response).
