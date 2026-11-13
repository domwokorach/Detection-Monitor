# Platform Policies

These policies describe how Detection Monitor **is designed to be operated** and where the code supports it. They are a framework for an operator to adopt, not a statement of legal compliance. **No certification, regulatory approval or legal guarantee is claimed.** Anyone deploying the platform with real data is the responsible organisation (the "Operator") and must obtain their own legal, data-protection and compliance advice.

> Placeholders marked `<…>` require the Operator's decision. Retention periods and contacts are **not** set in this repository.

## Contents

- [Scope](#scope)
- [Privacy and data handling](#privacy-and-data-handling)
- [UK GDPR considerations](#uk-gdpr-considerations)
- [Data retention](#data-retention)
- [Access management](#access-management)
- [Audit record retention](#audit-record-retention)
- [Analyst acceptable use](#analyst-acceptable-use)
- [Customer data protection](#customer-data-protection)
- [Sensitive data exports](#sensitive-data-exports)
- [Third-party API data sharing](#third-party-api-data-sharing)
- [Incident response](#incident-response)
- [Accessibility practices](#accessibility-practices)
- [Review](#review)

## Scope

Applies to anyone who operates or uses a deployment of Detection Monitor. The repository ships only **synthetic data**; no real customer data is included or should be committed.

## Privacy and data handling

| Data | Where it appears | Handling in the code |
|---|---|---|
| Account holder name, masked account number, home country, UK local authority code, optional registered address | `accounts` | Address masked for non-admins; account numbers stored masked |
| Transaction amount, currency, direction, counterparty, country, timestamps | `transactions` | Visible to authenticated users |
| Source IP, ISP/ASN, VPN flag, reputation, estimated location | `transaction_contexts` | IP masked for non-admins; unmasked views by admins are audited |
| Analyst identity (email, display name, role), password hash | `users` | Passwords Argon2-hashed; never logged |
| Review notes, dispositions, confirmed loss | `alerts` | Free text: analysts must not enter unnecessary personal data |
| Audit entries | `audit_events` | Append-only by design; contain actor email and before/after values |

Principles: collect only what monitoring needs; mask by default; show personal data on a need-to-know basis; never use production data in demos or screenshots; keep secrets and personal data out of logs, tickets and Git.

## UK GDPR considerations

Processing real customer data through this platform would be personal-data processing under UK GDPR and the Data Protection Act 2018. Points an Operator should address (this list is **not exhaustive and is not legal advice**):

- **Lawful basis and purpose**: identify and document the basis for fraud/AML monitoring and any special-category or criminal-offence data implications.
- **Roles**: controller/processor responsibilities, and written processor contracts with any hosting or API provider.
- **Transparency**: privacy notices that explain monitoring. The in-app Privacy page is a template with placeholders and **must be completed** by the Operator.
- **Data minimisation, accuracy and storage limitation**: see retention below. IP geolocation is an estimate and can be wrong.
- **Automated decision-making**: the platform scores and flags; humans review alerts. Operators must decide whether any downstream decision is solely automated and whether additional safeguards apply.
- **Data subject rights**: access, rectification, erasure and objection requests need a process. The application has **no built-in tooling** for subject-access exports or erasure; hash-chained audit entries add complexity to erasure and must be considered in design.
- **DPIA**: conduct a Data Protection Impact Assessment before processing real data.
- **Security**: see [SECURITY.md](SECURITY.md); report notifiable breaches to the ICO within 72 hours where required.
- **International transfers**: see third-party sharing below.
- **Registration and accountability**: ICO fee, records of processing, and a DPO if required.

## Data retention

The platform **does not enforce retention periods** for transactions, alerts or cases. Intended defaults for the Operator to set:

| Data | Retention period | Source |
|---|---|---|
| Transactions, alerts, cases | `<Operator to define; align with regulatory record-keeping duties>` | Not enforced in code |
| Audit entries | See below | Not deleted by the application |
| Access tokens | Expire after `JWT_TTL_MINUTES` (default 480); revoked-token records are purged once expired | Enforced |
| Export files | Expire after `EXPORT_TTL_SECONDS` (default 900 s) or on first download; securely deleted | Enforced |
| Redis | No persistence | Enforced by Compose configuration |
| Demo-mode browser data | Memory only; lost on reload | Enforced |

Deleting rows from a hash-chained log breaks verification. Any archive-and-prune process must preserve a signed checkpoint of the chain head.

## Access management

- Role model: `analyst` and `admin` ([SECURITY.md](SECURITY.md#authorisation-and-role-based-access-control)).
- Grant the **least privilege** needed; limit admin accounts; one account per person; no shared credentials.
- Replace and remove demo accounts before any real use.
- Review access at least `<quarterly: Operator to confirm>` and promptly on joiner, mover or leaver events. The platform has no user-management UI; this is a manual or database-level process.
- Enforce MFA/SSO at the identity layer before real use (not implemented in the application).
- Rule changes are administrator-only and audited.

## Audit record retention

- Audit entries are never edited or deleted by the application. Corrections are made by appending new entries.
- Retention period: `<Operator to define; commonly measured in years for financial-crime records>`.
- Recommended: periodically verify the chain (`GET /api/audit/verify`), export signed snapshots to write-once storage, and restrict database privileges so only inserts are allowed on `audit_events`.
- Treat a failed verification as a security incident.

## Analyst acceptable use

Analysts must:

- use the system only for legitimate monitoring and investigation duties;
- access only the cases they need, and not look up friends, family, colleagues or celebrities;
- record factual, proportionate notes, without speculation or unnecessary personal data;
- treat a rule match or alert as a lead, not a conclusion; document the evidence behind each disposition;
- never share credentials, screenshots or exports outside approved channels;
- never use real customer data in demo mode or in tickets;
- not tip off a subject of an investigation where doing so could be unlawful (seek compliance guidance).

Misuse may lead to disciplinary action under the Operator's policies. Personal-data views by admins and all exports are audited.

## Customer data protection

- Use masked views by default; request an admin only when unmasked data is genuinely needed.
- Do not copy customer data into email, chat, spreadsheets or AI tools outside the approved environment.
- The "Analyst assistant" restates stored case evidence deterministically and sends nothing to an external AI service.
- Do not paste secrets or customer data into issue trackers or screenshots. The README screenshots use simulated data only.
- Logos and brand lookups send only a merchant name or domain, not customer data (see below).

## Sensitive data exports

- CSV export is permitted for roles in `EXPORT_ROLES` (default `admin,analyst`); narrow it to the minimum.
- Each export is audited (requested, generated, downloaded, denied) with scope, filters, row count and whether personal data was masked. A file is released only after its audit entry is written.
- Non-admin exports contain masked personal data.
- Spreadsheet formula injection is neutralised, but the recipient must still handle files as sensitive: store in approved locations, do not forward, delete when done.
- Large exports are single-use, owner-only, short-lived and securely deleted.
- Exports are point-in-time snapshots and become stale; do not treat an old file as current.

## Third-party API data sharing

| Service | What leaves the platform | Notes |
|---|---|---|
| TrueLayer (sandbox) | OAuth exchange with TrueLayer; data flows **from** TrueLayer's sandbox in | Sandbox test data only. A production use needs an agreement, consent flows and a DPIA |
| Logo.dev | Merchant name queries (server-side) and domain-based logo image requests (from the analyst's browser) | The browser request reveals the analyst's IP address and the domain to Logo.dev. Disable by leaving the keys blank |
| OpenFreeMap / OpenStreetMap tiles | The analyst's browser requests map tiles | Reveals browser IP and map viewport to the tile host |
| IP geolocation | None: no live provider is integrated | Estimates are stored with the transaction when supplied |

Before enabling any provider with real data, review its terms, location of processing and sub-processors, and update the privacy notice.

## Incident response

An "incident" is any suspected or actual loss, exposure, corruption or unauthorised use of data or systems, including a failed audit-chain verification, leaked secret, anomalous export or suspected account compromise.

| Phase | Actions |
|---|---|
| 1. Detect and report | Anyone who suspects an incident reports it at once to `<security contact: requires configuration>`. Vulnerabilities from outsiders follow [SECURITY.md](SECURITY.md#reporting-vulnerabilities) |
| 2. Triage | Assign an incident lead; classify severity; start a time-stamped log |
| 3. Contain | Revoke tokens (sign out affected users), rotate `JWT_SECRET` (invalidates all sessions), disable accounts, block network access, disable exports (`EXPORT_ROLES=`) |
| 4. Preserve | Snapshot the database and logs; run `GET /api/audit/verify` and record the result; do not alter audit data |
| 5. Eradicate and recover | Fix root cause, rotate every exposed secret, restore from a known-good backup if needed, verify integrity |
| 6. Notify | Assess legal duties: ICO within 72 hours for notifiable personal-data breaches, affected individuals where required, and any regulatory or contractual notifications. Take legal advice |
| 7. Review | Post-incident review, update controls and [RISK.md](RISK.md) |

Rehearse this plan; contacts and on-call arrangements are **not** defined in this repository.

## Accessibility practices

- Target: WCAG 2.2 AA for the interface. **This is a goal; no formal audit or conformance claim has been made.**
- Practices in the design system ([DESIGN.md](DESIGN.md#accessibility)): colour never the only signal, text labels on severity, keyboard-operable controls using accessible primitives, visible focus, reduced-motion support, text alternatives for maps.
- Known gaps: contrast has not been audited; map interaction relies on a keyboard alternative rather than full keyboard map navigation; screen-reader testing has not been recorded.
- Report accessibility barriers to `<accessibility contact: requires configuration>`.

## Review

Review these policies at least annually and after any significant change, incident or new integration. Owner: `<policy owner: unassigned>`. Last reviewed: `<date: not yet reviewed>`.
