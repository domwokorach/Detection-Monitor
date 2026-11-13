# Risk Register

A structured register of the principal risks to Detection Monitor's accuracy, security and operation.

> **Important.** No formal risk assessment has been carried out. **Likelihood and Impact ratings are illustrative** (the author's initial judgement for a portfolio MVP processing synthetic data) and have **not** been approved by any owner. **Owners are unassigned** and must be allocated by the project owner. Statuses reflect what the code does today. If the platform is ever used with real data, every rating must be re-assessed.

## Contents

- [Rating scale](#rating-scale)
- [Register](#register)
- [Mitigation status key](#status-key)
- [Hardening backlog](#hardening-backlog)
- [Review](#review)

## Rating scale

| Rating | Likelihood (illustrative) | Impact (illustrative) |
|---|---|---|
| Low | Unlikely in normal operation | Minor, easily corrected |
| Medium | Plausible during the system's life | Noticeable harm to analysts, accuracy or data |
| High | Expected without further controls | Significant harm: data exposure, regulatory or financial consequence |

## Register

| Risk ID | Description | Likelihood | Impact | Mitigation | Owner | Status |
|---|---|---|---|---|---|---|
| R-01 | **Detection false positives**: legitimate payments are flagged by simple thresholds (for example a genuine GBP 12,500 invoice), wasting analyst time and inconveniencing customers | High (illustrative) | Medium (illustrative) | Analyst review and `FALSE_POSITIVE` disposition; per-rule weights and thresholds are configurable; matches carry explanations. Not yet: false-positive metrics, per-customer baselines | Unassigned | Partly mitigated |
| R-02 | **Detection false negatives**: fraud that avoids the four rule kinds (for example many payments just under a threshold, or in another currency) is not alerted | High (illustrative) | High (illustrative) | Velocity and cumulative rules; contextual factors for analysts. Not yet: structuring detection, baselines, entity linkage, ML, FX normalisation | Unassigned | Open |
| R-03 | **Misconfigured rules**: wrong weight, threshold, window or disabled rule silently changes detection | Medium (illustrative) | High (illustrative) | Admin-only changes; strict config validation; optimistic version check; versioned changes with before/after audit entries; match snapshots keep history. Not yet: change approval (four-eyes), dry-run or back-testing | Unassigned | Partly mitigated |
| R-04 | **Stale transaction data**: the worker is down or lagging, or the UI shows an old snapshot, so analysts act on out-of-date state | Medium (illustrative) | Medium (illustrative) | Outbox polling; pending-job count in `/api/overview`; UI auto-refresh and live streams; export timestamps. Not yet: queue-lag alerting or SLOs | Unassigned | Partly mitigated |
| R-05 | **Lost or duplicate event processing**: crashes or retries cause missed or repeated screening | Medium (illustrative) | High (illustrative) | Transactional outbox in the same commit as the transaction; `SKIP LOCKED` worker; idempotent screening (no duplicate alert); `external_id` idempotency with conflict detection; five retries, then `FAILED` and audited. At-least-once, not exactly-once. Not yet: dead-letter tooling or replay | Unassigned | Mitigated, with residual risk |
| R-06 | **Unauthorised data access**: stolen credentials, weak demo passwords left in place, or missing MFA/rate limiting expose cases and personal data | Medium (illustrative) | High (illustrative) | Argon2; expiring and revocable JWTs; server-side RBAC; PII masked for analysts; admin PII views audited; case-assignment locks. Not yet: MFA/SSO, lockout, rate limiting, JWT rotation, CSP/CSRF headers | Unassigned | Open |
| R-07 | **Third-party API outage or change** (TrueLayer sandbox, Logo.dev, map tiles) degrades features | Medium (illustrative) | Low (illustrative) | Integrations are optional and isolated; brand search is cached, retried and rate-limit aware; map shows a tile-error banner; core screening does not depend on any of them | Unassigned | Mitigated |
| R-08 | **Inaccurate IP geolocation**: location estimates are wrong, outdated or masked by VPNs, leading to false mismatch signals or missed ones | High (illustrative) | Medium (illustrative) | Labelled as inferred, with provider, confidence and accuracy; used only as an analyst signal, not in the score; risk map uses account location, not IP. No live provider is integrated, and demo values are synthetic | Unassigned | Partly mitigated |
| R-09 | **Incorrect UK geographic aggregation**: wrong or missing local-authority codes, outdated boundaries, or district-to-county mapping errors misplace risk | Medium (illustrative) | Medium (illustrative) | Location is the account's recorded GSS code; unlocated alerts are counted, not guessed; tests cover the risk-map endpoint; ONS boundaries. Not yet: validation of codes against current boundary vintages, boundary change handling | Unassigned | Partly mitigated |
| R-10 | **Data export leakage**: a CSV with personal or financial data is shared, retained or opened unsafely | Medium (illustrative) | High (illustrative) | Role-gated; server-side masking for non-admins; fail-closed audit before release; single-use, owner-only, short-lived, securely deleted files; spreadsheet formula neutralisation. Not yet: watermarking, DLP, encrypted temp storage | Unassigned | Partly mitigated |
| R-11 | **Audit integrity failure**: a privileged user deletes or rewrites history and the chain head, or the log is lost | Low (illustrative) | High (illustrative) | SHA-256 chain with admin verification; locked head row. Not yet: external write-once retention, signed checkpoints, restricted DB privileges | Unassigned | Partly mitigated |
| R-12 | **Demo data mistaken for real data**: simulated metrics are presented as genuine fraud events | Medium (illustrative) | High (illustrative) | Persistent "Demo data" banner and badges; README and docs state data is simulated; synthetic IDs, `ZZ` and documentation IP ranges | Unassigned | Mitigated |
| R-13 | **Watchlist misunderstood as sanctions screening**: the country-code list is treated as a compliance control | Medium (illustrative) | High (illustrative) | Documented as an analyst-configured list; seeded with the fictional `ZZ`; no name matching. Not yet: maintained sanctions/PEP data | Unassigned | Open |
| R-14 | **Schema and deployment drift**: `create_all` and ad hoc `ALTER TABLE` replace versioned migrations | Medium (illustrative) | Medium (illustrative) | Additive-only changes today. Adopt Alembic and tested backup/restore | Unassigned | Open |
| R-15 | **Secrets mishandling**: committed `.env`, leaked keys, weak `JWT_SECRET` | Medium (illustrative) | High (illustrative) | `.env` git-ignored; placeholders in `.env.example`; secret key for Logo.dev kept server-side; TrueLayer secret blank in the example. Not yet: secret scanning, a secrets manager | Unassigned | Partly mitigated |
| R-16 | **Dependency vulnerabilities** in the Python or JavaScript supply chain | Medium (illustrative) | Medium (illustrative) | Version bounds and lock files. Not yet: automated scanning or update tooling | Unassigned | Open |
| R-17 | **Regulatory misrepresentation**: users assume the product is FCA-approved, certified or fit for AML obligations | Medium (illustrative) | High (illustrative) | Explicit non-affiliation and non-certification statements in README, POLICY and this register; MVP label. A SAR/STR workflow does not exist | Unassigned | Mitigated, by disclosure only |
| R-18 | **Privacy non-compliance** if real personal data is processed (UK GDPR duties, retention, subject rights, DPIA) | Medium (illustrative) | High (illustrative) | Policy framework in [POLICY.md](POLICY.md); masking; no built-in subject-rights or retention tooling. Operator must complete DPIA and notices | Unassigned | Open |
| R-19 | **Third-party rights and attribution**: unclear provenance of logo artwork, missed map or licence attributions | Medium (illustrative) | Medium (illustrative) | [COPYRIGHT.md](COPYRIGHT.md) lists attribution duties; map attribution is rendered in-app. Logo provenance is unresolved; no licence chosen ([LICENSE.md](LICENSE.md)) | Unassigned | Open |
| R-20 | **Scalability limits**: UI loads up to 500 rows per view and some analytics are computed in application code | Medium (illustrative) | Medium (illustrative) | Paginated register and exports; noted in the README. Move aggregation into SQL and test PostgreSQL at volume | Unassigned | Open |

### Status key

| Status | Meaning |
|---|---|
| Mitigated | The main control exists in code; residual risk remains |
| Partly mitigated | Some controls exist; named gaps remain |
| Open | Little or no control yet |

## Hardening backlog

Required before real-data use, drawn from the register:

1. MFA/SSO, rate limiting, lockout, JWT rotation and security headers (R-06).
2. Versioned migrations, least-privilege database roles, tested backups (R-14).
3. External write-once audit retention with signed checkpoints (R-11).
4. Sanctions/PEP data integration and a SAR/STR workflow if used for AML (R-13, R-17).
5. Rule change approval, dry-run and back-testing; false-positive and false-negative metrics (R-01 to R-03).
6. Queue-lag alerting, dead-letter handling and replay (R-04, R-05).
7. Retention tooling, subject-rights processes and a completed DPIA (R-18).
8. Dependency, secret and container scanning in CI (R-15, R-16).
9. Licence decision and artwork provenance (R-19).

## Review

Owner: `<unassigned>`. Last reviewed: `<not yet reviewed>`. Re-assess after any change to rules, integrations, hosting or data sources, and at least annually.
