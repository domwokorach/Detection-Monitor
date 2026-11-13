# Detection Rules and Risk Scoring

This document explains how Detection Monitor decides that a transaction deserves attention. It describes the behaviour of the code in `backend/app/services/rules.py`, `screening.py` and `investigation.py`. Examples are marked **Implemented** (matches the backend) or **Conceptual** (illustrative only, not in the code).

> The rules are deterministic, explainable thresholds. They are **demonstration policies**, not a substitute for an institution's fraud controls, sanctions screening, AML programme or statutory reporting duties. Seeded values are synthetic.

## Contents

- [Terminology](#terminology)
- [Pipeline](#pipeline)
- [Rule kinds](#rule-kinds)
- [Risk score calculation](#risk-score-calculation)
- [Threshold-based alerts](#threshold-based-alerts)
- [Score bands in different views](#score-bands-in-different-views)
- [The UK Risk Map threshold](#the-uk-risk-map-threshold)
- [Contextual signals](#contextual-signals-unusual-patterns-and-geographic-anomalies)
- [Rule activation, configuration and versioning](#rule-activation-configuration-and-versioning)
- [Evidence and explanations](#evidence-and-explanations)
- [Rule matches, alerts, findings and confirmed fraud](#rule-matches-alerts-findings-and-confirmed-fraud)
- [Known limits](#known-limits)

## Terminology

| Term | Meaning |
|---|---|
| Rule | A configured test (`kind`, `config`, `weight`, `enabled`, `version`) |
| Rule match | One rule fired on one transaction. Stored once per transaction and rule, with reason and configuration snapshot |
| Risk score | Integer 0–100: sum of matched rule weights, capped at 100 |
| Alert | A case created when a transaction's score reaches the alert threshold |
| Disposition | The analyst's closing decision: `SUSPICIOUS` or `FALSE_POSITIVE` |

## Pipeline

1. `POST /api/transactions` stores the transaction and an outbox event in one database transaction.
2. The worker locks the event and the account row (so parallel workers cannot under-count the same account).
3. All **enabled** rules are evaluated, ordered by code.
4. Each match is stored with its rule version, configuration snapshot, weight and human-readable reason.
5. The score is set, and an alert is created if the threshold is reached.
6. Audit events `TRANSACTION_SCREENED` and, if applicable, `ALERT_CREATED` are appended.

## Rule kinds

Configuration is validated on create and update (`validate_config`); unknown or extra keys are rejected with HTTP 422. Weights are integers from 1 to 100.

### Amount threshold: high-value transactions (`AMOUNT_THRESHOLD`)

Fires when `amount >= minimum`, in the transaction's own currency, in either direction.

```json
{ "code": "LARGE_AMOUNT", "kind": "AMOUNT_THRESHOLD", "config": { "minimum": "10000" }, "weight": 50 }
```
*Implemented (seeded demo rule).*

### Velocity: transaction velocity (`VELOCITY`)

Counts outgoing (`DEBIT`) transactions from the same account **and currency** whose `occurred_at` falls in the `window_minutes` ending at the current transaction. The current transaction counts, so `min_count: 3` means "this one plus at least two earlier". `window_minutes` is 1–10080, `min_count` 1–1000. Applies to debits only.

```json
{ "code": "HIGH_VELOCITY", "kind": "VELOCITY", "config": { "window_minutes": 10, "min_count": 3 }, "weight": 45 }
```
*Implemented (seeded).*

### Cumulative amount: unusual outflow (`CUMULATIVE_AMOUNT`)

Sums outgoing amounts for the same account and currency in the window (including the current one) and fires when the total reaches `minimum_total`. Debits only.

```json
{ "code": "OUTFLOW_SPIKE", "kind": "CUMULATIVE_AMOUNT", "config": { "window_minutes": 60, "minimum_total": "15000" }, "weight": 35 }
```
*Implemented (seeded).*

### Country watchlist: watchlist matches (`COUNTRY_WATCHLIST`)

Fires when the transaction's `country` is in the configured list of two-letter codes. `list_type` is optional: `SANCTIONS`, `PEP` or `OTHER`; it only categorises hits in the watchlist analytics.

```json
{ "code": "WATCHLIST_COUNTRY", "kind": "COUNTRY_WATCHLIST", "config": { "countries": ["ZZ"], "list_type": "OTHER" }, "weight": 65 }
```
*Implemented. The seeded list contains the non-existent code `ZZ`.*

> This is a **configured country-code list maintained by an analyst**. It is not a sanctions, PEP or adverse-media feed, does not screen names, and must not be relied on for sanctions compliance. `list_type` is a label, not a data source.

### Example not in the backend (Conceptual)

A "dormant account suddenly active" or "round-amount structuring" rule is a plausible future kind, but **no such rule kind exists**. Adding one requires code in `RULE_KINDS`, `validate_config`, `evaluate` and the `RuleIn` schema.

## Risk score calculation

```text
score = min(100, sum(weight of every matched, enabled rule))
```

Worked example (**Implemented** behaviour with seeded rules): a GBP 12,500 payment to a `ZZ` counterparty matches `LARGE_AMOUNT` (50) and `WATCHLIST_COUNTRY` (65): 50 + 65 = 115, capped to **100**.

Each rule contributes at most once per transaction.

## Threshold-based alerts

An alert is created when `risk_score >= ALERT_THRESHOLD` (environment variable, default **40**). Alert `priority`:

| Score | Priority |
|---|---|
| 40–49 (or any below 50 above the threshold) | `LOW` |
| 50–74 | `MEDIUM` |
| 75–100 | `HIGH` |

If the operator raises `ALERT_THRESHOLD`, existing alerts are not removed.

## Score bands in different views

The same score is banded differently depending on the view. This is current behaviour, listed so nobody is surprised:

| View | Bands |
|---|---|
| Backend alert `priority` | `LOW` < 50, `MEDIUM` 50–74, `HIGH` ≥ 75 |
| Dashboard donut and badges (`lib/risk.ts`) | Low < 40, Medium 40–59, High 60–79, Critical ≥ 80 |
| Alert queue, investigations register, risk map (`register.severity`, `alertRiskLevel`) | Moderate < 60, Elevated 60–69, High 70–84, Critical 85–100 |

## The UK Risk Map threshold

```text
risk_score >= 60
```

`RISK_MAP_THRESHOLD = 60` in `backend/app/api.py`. `GET /api/risk-map` rejects any `min_score` below 60. Only alerts that are **not closed** and have a score at or above 60 are returned. Each is placed using the **account's recorded UK local authority code**, never an IP address. Alerts on accounts without a code are returned as a count (`unlocated`), not plotted. The same value (`HIGH_RISK_SCORE = 60`) marks a watchlist hit as "high risk" and the investigation workspace uses it to find related suspicious activity.

Map legend: 60–69 Medium-high/Elevated, 70–84 High, 85+ Critical.

## Contextual signals: unusual patterns and geographic anomalies

The investigation workspace (`/api/alerts/{id}/investigation`) shows additional **informational factors**. They are shown to the analyst as evidence but **do not change the risk score and do not create alerts**:

| Factor | Logic | Notes |
|---|---|---|
| `IP_COUNTRY_MISMATCH` | Estimated IP country differs from the payment destination or the account's home country | Provider estimate with confidence and accuracy shown; never treated as verified |
| `UNUSUAL_TIME` | Payment between 00:00 and 05:59 UK time | A documented heuristic, not policy |
| `VELOCITY` | Three or more outgoing payments from the account in the preceding hour | Independent of the scored `VELOCITY` rule |
| `SHARED_IP` | More than one account has transacted from the same source IP | |
| `HIGH_VALUE` | Amount at or above the lowest enabled `AMOUNT_THRESHOLD` rule | `unavailable` if none is enabled |

Factors report `flagged`, `clear` or `unavailable` (when data such as an IP is missing). IP geolocation is an estimate; see [RISK.md](RISK.md).

## Rule activation, configuration and versioning

- **Create / update** is administrator-only (`POST /api/rules`, `PATCH /api/rules/{id}`).
- **Activation:** `enabled` toggles evaluation. Disabled rules are skipped entirely.
- **Optimistic concurrency:** `PATCH` must send `expected_version`; a mismatch returns HTTP 409 ("Rule version changed; reload and retry").
- **Versioning:** every successful change increments `version`.
- **History:** there is no separate rule-history table. History is reconstructed from (a) `RULE_CREATED` / `RULE_UPDATED` audit entries holding full before/after values (name, description, config, weight, enabled, version), and (b) each rule match's stored `rule_version` and `rule_config_snapshot`. Editing a rule never rewrites earlier matches or scores.
- **No re-scoring:** changed rules apply to transactions screened afterwards. Existing alerts keep their score and evidence.
- **Statistics:** `GET /api/rules/stats` returns match counts and last-match time per rule code.

## Evidence and explanations

Each match stores a reason produced at screening time, for example:

- `Amount 12500.00 GBP meets configured threshold 10000 GBP`
- `Destination country ZZ is in analyst-configured watchlist`
- `3 outgoing transactions within 10 minutes`
- `Outgoing amount totals 16500.00 GBP within 60 minutes`

The alert view, investigation timeline (hash-linked to audit entries) and the "Analyst assistant" / AI Risk Intelligence text all restate this stored evidence. That assistant is **deterministic text**, not a language model.

## Rule matches, alerts, findings and confirmed fraud

| Stage | Who decides | What it means | What it does **not** mean |
|---|---|---|---|
| Rule match | The engine | A configured condition was met | Wrongdoing |
| Alert | The engine (threshold) | Combined score warrants human review | A finding |
| Analyst finding | An analyst, recorded in notes and evidence | The analyst's assessment after review | Proof of fraud |
| Disposition `SUSPICIOUS` | An analyst closing the case | The analyst considers the activity suspicious | Legal determination or a filed report |
| Confirmed loss | An analyst, optional, GBP only, ≤ transaction amount | A loss the analyst has established | Anything inferred by the system |
| Confirmed fraud | **Outside this system** (institution, law enforcement, courts) | An external, authoritative conclusion | |

The dashboard KPI "Confirmed Suspicious" counts cases closed with disposition `SUSPICIOUS`. The platform does not file suspicious activity reports and has no SAR/STR workflow.

## Known limits

- Window rules use `occurred_at`; late-arriving transactions do **not** re-score earlier ones.
- Thresholds are per currency and not FX-normalised.
- No per-customer baselines, device fingerprinting, network analysis or machine learning.
- Rules see only the data supplied; false positives and false negatives are expected ([RISK.md](RISK.md)).
