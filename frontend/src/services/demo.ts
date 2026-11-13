/**
 * DEMO DATA ONLY. Used when the user explicitly chooses "Explore demo data" on the
 * login screen (typically because the FastAPI backend is not running). Every write
 * lives in memory and is lost on reload. The UI shows a persistent "Demo data" banner.
 */
import type {
  Account, Address, Alert, AlertDetail, AlertReview, Audit, Backend, Daily, GeoPoint, Investigation, IpIntel, Match, Merchant, Overview, RiskFactor, Rule, RuleIn,
  TimelineItem,
  RuleStat, RuleUpdate, Session, Transaction, User,
} from '@/types'
import { normalizeName } from '@/lib/merchant'
import { sanitizeDomain } from '@/lib/logo'
import { ApiError } from './http'

const DAY = 86_400_000
let seed = 7
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
const pick = <T,>(items: T[]): T => items[Math.floor(rnd() * items.length)]
const uid = () => Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10)
const hash = () => Array.from({ length: 64 }, () => Math.floor(rnd() * 16).toString(16)).join('')

const users: User[] = [
  { id: 'u-admin', email: 'admin@demo.local', display_name: 'Morgan Admin', role: 'admin' },
  { id: 'u-analyst', email: 'analyst@demo.local', display_name: 'Avery Analyst', role: 'analyst' },
]
let me: User = users[0]

const accounts: Account[] = [
  // Demo fixtures. la_code places each account in a UK local authority so the risk map has locations;
  // E07000028 (Carlisle, a district) exercises district → county resolution.
  { id: 'acct-retail-01', account_number_masked: '•••• 1042', holder_name: 'Northstar Retail', home_country: 'GB', la_code: 'E08000003' },
  { id: 'acct-trading-02', account_number_masked: '•••• 8805', holder_name: 'Oakline Trading', home_country: 'GB', la_code: 'E09000001' },
  { id: 'acct-personal-03', account_number_masked: '•••• 6291', holder_name: 'Rivera Personal', home_country: 'GB', la_code: 'W06000015' },
  { id: 'acct-fintech-04', account_number_masked: '•••• 3317', holder_name: 'Lumen Payments', home_country: 'IE', la_code: 'N09000003' },
  { id: 'acct-logistics-05', account_number_masked: '•••• 7740', holder_name: 'Harbour Logistics', home_country: 'GB', la_code: 'S12000046' },
  { id: 'acct-metals-06', account_number_masked: '•••• 2158', holder_name: 'Brightmoor Metals', home_country: 'GB', la_code: 'E08000025' },
  { id: 'acct-media-07', account_number_masked: '•••• 9026', holder_name: 'Calder Media', home_country: 'GB', la_code: 'E08000035' },
  { id: 'acct-farm-08', account_number_masked: '•••• 5513', holder_name: 'Eden Valley Farms', home_country: 'GB', la_code: 'E07000028' },
  { id: 'acct-legal-09', account_number_masked: '•••• 4471', holder_name: 'Forth Legal LLP', home_country: 'GB', la_code: 'S12000036' },
]
const counterparties = ['Meridian Goods', 'Alpine Supplies', 'Stonebridge Wholesale', 'Café purchase', 'Cloud Hosting Ltd',
  'Courier Direct', 'Training Example LLC', 'Harbour Logistics', 'Online shopping', 'Software Subscription',
  'Amazon', 'Tesco', 'Spotify', 'Apple Store', 'Currys', 'Barclays']
// Verified bindings (demo fixtures). Names not listed here deliberately get no logo.
const merchants: Merchant[] = [['Amazon', 'amazon.co.uk'], ['Tesco', 'tesco.com'], ['Spotify', 'spotify.com'], ['Apple Store', 'apple.com'], ['Currys', 'currys.co.uk'], ['Barclays', 'barclays.co.uk']]
  .map(([name, domain]) => ({ id: `m-${domain}`, name, normalized_name: normalizeName(name), domain, verified_by: 'seed', created_at: new Date(Date.now() - 6 * 86_400_000).toISOString() }))
const countries = ['GB', 'GB', 'GB', 'US', 'DE', 'FR', 'NL', 'ZZ', 'ES']

const now = Date.now()
const rules: Rule[] = [
  rule('LARGE_AMOUNT', 'Large outgoing amount', 'Single payment above a configured amount', 'AMOUNT_THRESHOLD', { minimum: '10000' }, 50),
  rule('WATCHLIST_COUNTRY', 'Configured destination watchlist', 'Synthetic ZZ code is for demonstration only', 'COUNTRY_WATCHLIST', { countries: ['ZZ'] }, 65),
  rule('HIGH_VELOCITY', 'Rapid outgoing payments', 'Several payments from one account within a short window', 'VELOCITY', { window_minutes: 10, min_count: 3 }, 45),
  rule('OUTFLOW_SPIKE', 'Elevated cumulative outflow', 'Sum of recent outgoing payments exceeds threshold', 'CUMULATIVE_AMOUNT', { window_minutes: 60, minimum_total: '15000' }, 35),
]
function rule(code: string, name: string, description: string, kind: Rule['kind'], config: Record<string, unknown>, weight: number): Rule {
  return { id: `r-${code}`, code, name, description, kind, config, weight, enabled: true, version: 1, updated_at: new Date(now - 6 * DAY).toISOString() }
}

const transactions: Transaction[] = []
const matchesByTx = new Map<string, Match[]>()
// Synthetic telemetry on documentation IP ranges; geo values are illustrative demo estimates, not lookups.
type Ctx = { ip: string; geo: IpIntel['geo']; isp: string; asn: string; vpn: boolean | null; rep: IpIntel['reputation'] }
const geoOf = (country: string, region: string, county: string | null, city: string, lat: number, lon: number, km: number, la: string | null, conf: 'low' | 'medium' | 'high'): IpIntel['geo'] =>
  ({ country, region, county, city, la_code: la, lat, lon, accuracy_km: km, provider: 'synthetic-demo', confidence: conf, inferred: true })
const CTX_POOL: Ctx[] = [
  { ip: '203.0.113.24', geo: geoOf('GB', 'England', 'Greater Manchester', 'Manchester', 53.483, -2.244, 10, 'E08000003', 'medium'), isp: 'Example Broadband', asn: 'AS64496', vpn: false, rep: 'clean' },
  { ip: '203.0.113.50', geo: geoOf('GB', 'England', 'Greater London', 'London', 51.509, -0.118, 8, 'E09000001', 'low'), isp: 'Example Mobile', asn: 'AS64498', vpn: null, rep: null },
  { ip: '198.51.100.77', geo: geoOf('DE', 'Hesse', null, 'Frankfurt am Main', 50.11, 8.682, 25, null, 'low'), isp: 'Example Hosting GmbH', asn: 'AS64497', vpn: true, rep: 'suspicious' },
  { ip: '203.0.113.88', geo: geoOf('GB', 'Scotland', 'City of Edinburgh', 'Edinburgh', 55.953, -3.188, 12, 'S12000036', 'medium'), isp: 'Example Fibre', asn: 'AS64499', vpn: false, rep: 'clean' },
]
const ctxByTx = new Map<string, Ctx>()
const addressByAccount: Record<string, Address> = {
  'acct-retail-01': { line1: '14 Example Street', line2: 'Unit 2', city: 'Manchester', county: 'Greater Manchester', postcode: 'M1 1AA', country: 'GB', source: 'synthetic-demo' },
  'acct-trading-02': { line1: '9 Sample Lane', line2: null, city: 'London', county: 'Greater London', postcode: 'EC1A 1BB', country: 'GB', source: 'synthetic-demo' },
}
const alerts: Alert[] = []
const audit: Audit[] = []
let lastHash = '0'.repeat(64)

function log(actor: string, action: string, entity_type: string, entity_id: string,
  before: Record<string, unknown> | null = null, after: Record<string, unknown> | null = null, at = Date.now()) {
  const entry_hash = hash()
  audit.push({ seq: audit.length + 1, id: uid(), actor, action, entity_type, entity_id, before, after,
    created_at: new Date(at).toISOString(), previous_hash: lastHash, entry_hash })
  lastHash = entry_hash
}

function screen(tx: Transaction): Alert | null {
  const matches: Match[] = []
  let score = 0
  for (const r of rules.filter(r => r.enabled)) {
    let reason: string | null = null
    if (r.kind === 'AMOUNT_THRESHOLD' && Number(tx.amount) >= Number(r.config.minimum))
      reason = `Amount ${tx.amount} ${tx.currency} meets configured threshold ${r.config.minimum} ${tx.currency}`
    if (r.kind === 'COUNTRY_WATCHLIST' && (r.config.countries as string[]).includes(tx.country))
      reason = `Destination country ${tx.country} is in analyst-configured watchlist`
    if (r.kind === 'VELOCITY' && tx.direction === 'DEBIT') {
      const windowMs = Number(r.config.window_minutes) * 60_000
      const count = transactions.filter(o => o.account_id === tx.account_id && o.direction === 'DEBIT'
        && o.id !== tx.id && +new Date(o.occurred_at) <= +new Date(tx.occurred_at)
        && +new Date(o.occurred_at) >= +new Date(tx.occurred_at) - windowMs).length + 1
      if (count >= Number(r.config.min_count)) reason = `${count} outgoing transactions within ${r.config.window_minutes} minutes`
    }
    if (r.kind === 'CUMULATIVE_AMOUNT' && tx.direction === 'DEBIT') {
      const windowMs = Number(r.config.window_minutes) * 60_000
      const total = transactions.filter(o => o.account_id === tx.account_id && o.direction === 'DEBIT'
        && o.id !== tx.id && +new Date(o.occurred_at) <= +new Date(tx.occurred_at)
        && +new Date(o.occurred_at) >= +new Date(tx.occurred_at) - windowMs)
        .reduce((s, o) => s + Number(o.amount), Number(tx.amount))
      if (total >= Number(r.config.minimum_total)) reason = `Outgoing amount totals ${total.toFixed(2)} ${tx.currency} within ${r.config.window_minutes} minutes`
    }
    if (reason) {
      matches.push({ id: uid(), rule_code: r.code, rule_version: r.version, rule_config_snapshot: { ...r.config }, score: r.weight, reason })
      score += r.weight
    }
  }
  tx.risk_score = Math.min(100, score)
  tx.screening_status = 'SCREENED'
  matchesByTx.set(tx.id, matches)
  if (tx.risk_score < 40) return null
  const alert: Alert = {
    id: uid(), transaction_id: tx.id, status: 'OPEN', priority: tx.risk_score >= 75 ? 'HIGH' : tx.risk_score >= 50 ? 'MEDIUM' : 'LOW',
    rule_codes: matches.map(m => m.rule_code), risk_score: tx.risk_score, assigned_to: null, disposition: null, review_note: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(), transaction: tx,
  }
  alerts.push(alert)
  log('system:screening', 'ALERT_CREATED', 'alert', alert.id, null, { transaction_id: tx.id, risk_score: tx.risk_score, matched_rule_codes: matches.map(m => m.rule_code) }, +new Date(tx.occurred_at))
  return alert
}

function addTransaction(at: number, forceBig = false) {
  const account = pick(accounts)
  const big = forceBig || rnd() < 0.12
  const tx: Transaction = {
    id: uid(), external_id: `DEMO-${String(transactions.length + 1).padStart(5, '0')}`, account_id: account.id,
    amount: (big ? 9000 + rnd() * 14000 : 20 + rnd() * 1800).toFixed(2), currency: 'GBP',
    direction: rnd() < 0.85 ? 'DEBIT' : 'CREDIT', counterparty: pick(counterparties), country: pick(countries),
    occurred_at: new Date(at).toISOString(), screening_status: 'PENDING', risk_score: 0,
  }
  transactions.push(tx)
  if (rnd() < 0.55) ctxByTx.set(tx.id, pick(CTX_POOL))
  log('analyst@demo.local', 'TRANSACTION_INGESTED', 'transaction', tx.id, null, { external_id: tx.external_id, amount: tx.amount }, at)
  screen(tx)
}

for (let i = 0; i < 160; i++) addTransaction(now - 7 * DAY + (i / 160) * 7 * DAY - rnd() * 3_600_000)
// A deterministic burst so velocity and outflow rules visibly fire.
for (let i = 0; i < 4; i++) addTransaction(now - 18 * 60_000 + i * 120_000, i === 3)
transactions.sort((a, b) => +new Date(a.occurred_at) - +new Date(b.occurred_at))
audit.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)).forEach((e, i) => { e.seq = i + 1 })
alerts.slice(0, 6).forEach((a, i) => { if (i % 2) a.status = 'IN_REVIEW' })

const maskIp = (ip: string) => ip.split('.').slice(0, 3).concat('•••').join('.')
const maskAddr = (a: Address | null): Address | null => a && ({ ...a, line1: a.line1 ? a.line1[0] + '••••' : null, line2: a.line2 ? a.line2[0] + '••••' : null, postcode: a.postcode ? a.postcode.split(' ')[0] + ' •••' : null })

function buildInvestigation(alert: Alert): Investigation {
  const tx = alert.transaction, ctx = ctxByTx.get(tx.id), reveal = me.role === 'admin', home = accounts.find(a => a.id === tx.account_id)?.home_country ?? null
  const ev = audit.filter(e => e.entity_id === alert.id || e.entity_id === tx.id)
  const reviews = ev.filter(e => e.action === 'ALERT_REVIEWED')
  const sameIp = ctx ? transactions.filter(t => ctxByTx.get(t.id)?.ip === ctx.ip) : []
  const sharing = new Set(sameIp.map(t => t.account_id))
  const ip: IpIntel | null = ctx ? {
    address: reveal ? ctx.ip : maskIp(ctx.ip), masked: !reveal, version: 4, telemetry: { source: 'Captured with the transaction', captured_at: tx.occurred_at },
    geo: ctx.geo, network: { isp: ctx.isp, asn: ctx.asn }, vpn_proxy: ctx.vpn, reputation: ctx.rep,
    first_seen: sameIp.map(t => t.occurred_at).sort()[0], last_seen: sameIp.map(t => t.occurred_at).sort().at(-1)!,
    related_transactions: sameIp.length - 1, related_alerts: alerts.filter(a => a.id !== alert.id && ctxByTx.get(a.transaction_id)?.ip === ctx.ip).length, accounts_sharing: sharing.size,
  } : null
  const local = new Date(new Date(tx.occurred_at).toLocaleString('en-US', { timeZone: 'Europe/London' }))
  const burst = transactions.filter(t => t.account_id === tx.account_id && t.direction === 'DEBIT' && +new Date(tx.occurred_at) - +new Date(t.occurred_at) >= 0 && +new Date(tx.occurred_at) - +new Date(t.occurred_at) <= 3_600_000).length
  const big = rules.find(r => r.kind === 'AMOUNT_THRESHOLD' && r.enabled)
  const f = (code: string, label: string, status: RiskFactor['status'], explanation: string, evidence: string | null = null): RiskFactor => ({ code, label, status, explanation, evidence })
  const factors: RiskFactor[] = [
    ctx?.geo.country ? f('IP_COUNTRY_MISMATCH', 'IP and transaction country mismatch', ctx.geo.country !== tx.country || (!!home && ctx.geo.country !== home) ? 'flagged' : 'clear', `IP estimated in ${ctx.geo.country}; payment destination ${tx.country}; account home ${home ?? 'unknown'}.`, 'Provider estimate (synthetic-demo), not a verified location.')
      : f('IP_COUNTRY_MISMATCH', 'IP and transaction country mismatch', 'unavailable', 'No IP-based country estimate is available for this transaction.'),
    f('UNUSUAL_TIME', 'Unusual transaction time', local.getHours() < 6 ? 'flagged' : 'clear', `Payment made at ${String(local.getHours()).padStart(2, '0')}:${String(local.getMinutes()).padStart(2, '0')} UK time. Heuristic: 00:00–05:59 is treated as unusual.`),
    f('VELOCITY', 'Velocity of recent payments', burst >= 3 ? 'flagged' : 'clear', `${burst} outgoing payment(s) from this account in the hour up to this transaction.`),
    ctx ? f('SHARED_IP', 'Multiple accounts using the same IP', sharing.size > 1 ? 'flagged' : 'clear', `${sharing.size} account(s) have transacted from this source IP.`) : f('SHARED_IP', 'Multiple accounts using the same IP', 'unavailable', 'No source IP was captured for this transaction.'),
    big ? f('HIGH_VALUE', 'High-value transaction', Number(tx.amount) >= Number(big.config.minimum) ? 'flagged' : 'clear', `£${Number(tx.amount).toLocaleString('en-GB')} against the configured threshold of £${Number(big.config.minimum).toLocaleString('en-GB')}.`) : f('HIGH_VALUE', 'High-value transaction', 'unavailable', 'No amount-threshold rule is enabled to define high value.'),
  ]
  const tl: TimelineItem[] = []
  const add = (kind: TimelineItem['kind'], title: string, at: string, actor: string, detail: string | null = null, e?: Audit) => tl.push({ kind, title, at, actor, detail, entry_hash: e?.entry_hash ?? null, seq: e?.seq ?? null })
  for (const e of ev) {
    const a = e.after ?? {}, b = e.before ?? {}
    if (e.action === 'TRANSACTION_INGESTED') add('received', 'Transaction received', e.created_at, e.actor, null, e)
    else if (e.action === 'ALERT_CREATED') { add('rules', 'Risk rules evaluated', e.created_at, e.actor, `Risk score ${alert.risk_score}`, e); add('alert', 'Suspicious alert generated', e.created_at, e.actor, null, e) }
    else if (e.action === 'EVIDENCE_REVIEWED') add('evidence', 'Evidence reviewed', e.created_at, e.actor, (a.note as string) ?? null, e)
    else if (e.action === 'ALERT_REVIEWED') {
      if (a.assigned_to && a.assigned_to !== b.assigned_to) add('assigned', 'Analyst assigned', e.created_at, e.actor, `Assigned to ${users.find(u => u.id === a.assigned_to)?.display_name ?? 'an analyst'}`, e)
      if (a.status !== b.status) add(a.status === 'IN_REVIEW' ? 'opened' : a.status === 'ESCALATED' ? 'escalated' : 'closed', a.status === 'IN_REVIEW' ? 'Investigation opened' : a.status === 'ESCALATED' ? 'Case escalated' : 'Case closed', e.created_at, e.actor, null, e)
      if (a.review_note && a.review_note !== b.review_note) add('note', 'Note added', e.created_at, e.actor, a.review_note as string, e)
    }
  }
  tl.sort((x, y) => +new Date(x.at) - +new Date(y.at))
  const opened = reviews.find(e => (e.after as { status?: string; assigned_to?: string })?.status !== 'OPEN' || (e.after as { assigned_to?: string })?.assigned_to)
  const points: GeoPoint[] = transactions.filter(t => t.risk_score >= 60 && ctxByTx.get(t.id)?.geo.lat != null && (t.account_id === tx.account_id || (ctx && ctxByTx.get(t.id)?.ip === ctx.ip))).slice(0, 25)
    .map(t => { const c = ctxByTx.get(t.id)!; return { transaction_id: t.id, risk_score: t.risk_score, lat: c.geo.lat!, lon: c.geo.lon!, city: c.geo.city, country: c.geo.country, la_code: c.geo.la_code, accuracy_km: c.geo.accuracy_km, counterparty: t.counterparty, amount: t.amount, currency: t.currency, occurred_at: t.occurred_at, current: t.id === tx.id } })
  const merchant = merchants.find(m => m.normalized_name === normalizeName(tx.counterparty))
  return {
    alert_id: alert.id, case_ref: `INV-${alert.id.replace(/-/g, '').slice(-5).toUpperCase()}`, can_view_pii: reveal,
    account: { id: tx.account_id, holder_name: accounts.find(a => a.id === tx.account_id)?.holder_name ?? null, account_number_masked: accounts.find(a => a.id === tx.account_id)?.account_number_masked ?? null, home_country: home },
    merchant: { name: tx.counterparty, domain: merchant?.domain ?? null },
    assignee: alert.assigned_to ? { id: alert.assigned_to, display_name: users.find(u => u.id === alert.assigned_to)?.display_name ?? 'Unknown analyst' } : null,
    timestamps: { transaction: tx.occurred_at, received: tx.occurred_at, detected: alert.created_at, opened: opened?.created_at ?? alert.created_at, last_activity: alert.updated_at, reviewed: reviews.at(-1)?.created_at ?? null, processing_seconds: Math.max(0, (+new Date(alert.created_at) - +new Date(tx.occurred_at)) / 1000) },
    ip, addresses: { masked: !reveal, customer: reveal ? addressByAccount[tx.account_id] ?? null : maskAddr(addressByAccount[tx.account_id] ?? null), merchant: null },
    factors, linked: alerts.filter(o => o.id !== alert.id && o.risk_score >= 60 && (o.transaction.account_id === tx.account_id || (!!ctx && ctxByTx.get(o.transaction_id)?.ip === ctx.ip))).slice(0, 10)
      .map(o => ({ alert_id: o.id, risk_score: o.risk_score, status: o.status, counterparty: o.transaction.counterparty, reason: o.transaction.account_id === tx.account_id ? 'Same account' : 'Same source IP', created_at: o.created_at })),
    related_points: points, timeline: tl,
  }
}

const wait = <T,>(value: T, ms = 380): Promise<T> => new Promise(resolve => setTimeout(() => resolve(structuredClone(value)), ms))
const byRecent = <T extends { created_at: string }>(rows: T[]) => [...rows].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))

export const demoBackend: Backend = {
  async login(email) {
    const user = users.find(u => u.email === email) ?? users[0]
    me = user
    return wait<Session>({ access_token: 'demo-token', token_type: 'bearer', user })
  },
  async logout() { me = users[0] },
  async overview() {
    const screened = transactions.filter(t => t.screening_status === 'SCREENED').length
    const open = alerts.filter(a => a.status !== 'CLOSED')
    return wait<Overview>({
      transactions: transactions.length, screened, flagged: alerts.length, open_alerts: open.length,
      high_priority: open.filter(a => a.priority === 'HIGH').length, pending_jobs: 0,
      alert_rate: screened ? Math.round(alerts.length * 1000 / screened) / 10 : 0,
    })
  },
  async daily(days) {
    const rows: Daily[] = []
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now - i * DAY).toISOString().slice(0, 10)
      const day = transactions.filter(t => t.occurred_at.startsWith(date))
      rows.push({ date, transactions: day.length, flagged: day.filter(t => t.risk_score >= 40).length })
    }
    return wait(rows)
  },
  accounts: () => wait(accounts),
  async transactions() {
    // Simulated live feed: occasionally a new payment arrives between polls.
    if (rnd() < 0.5) addTransaction(Date.now())
    return wait([...transactions].sort((a, b) => +new Date(b.occurred_at) - +new Date(a.occurred_at)), 220)
  },
  async transaction(id) {
    const tx = transactions.find(t => t.id === id)
    if (!tx) throw new ApiError(404, 'Transaction not found')
    return wait({ ...tx, matches: matchesByTx.get(id) ?? [] }, 160)
  },
  async investigation(id) {
    const alert = alerts.find(a => a.id === id)
    if (!alert) throw new ApiError(404, 'Alert not found')
    return wait(buildInvestigation(alert), 240)
  },
  async evidenceReviewed(id, note) {
    const alert = alerts.find(a => a.id === id)
    if (!alert) throw new ApiError(404, 'Alert not found')
    if (alert.status === 'CLOSED') throw new ApiError(409, 'Closed cases are immutable')
    log(me.email, 'EVIDENCE_REVIEWED', 'alert', alert.id, null, { note: note?.trim() || null })
  },
  riskMap: () => {
    const la = new Map(accounts.map(a => [a.id, a.la_code]))
    const live = alerts.filter(a => a.risk_score >= 60 && a.status !== 'CLOSED')
    const events = live.filter(a => la.get(a.transaction.account_id)).map(a => ({
      alert_id: a.id, transaction_id: a.transaction_id, la_code: la.get(a.transaction.account_id)!, risk_score: a.risk_score, status: a.status,
      amount: a.transaction.amount, currency: a.transaction.currency, direction: a.transaction.direction, counterparty: a.transaction.counterparty,
      occurred_at: a.transaction.occurred_at, updated_at: a.updated_at, location_basis: 'account_local_authority' as const,
    }))
    const version = `${events.length}:${live.length - events.length}:${events.map(e => e.updated_at).sort().at(-1) ?? ''}:${events.reduce((n, e) => n + e.risk_score, 0)}`
    return wait({ threshold: 60, generated_at: new Date().toISOString(), version, unlocated: live.length - events.length, events }, 200)
  },
  alerts: () => wait(byRecent(alerts)),
  async alert(id) {
    const alert = alerts.find(a => a.id === id)
    if (!alert) throw new ApiError(404, 'Alert not found')
    return wait<AlertDetail>({ ...alert, matches: matchesByTx.get(alert.transaction_id) ?? [] }, 200)
  },
  async reviewAlert(id, body: AlertReview) {
    const alert = alerts.find(a => a.id === id)
    if (!alert) throw new ApiError(404, 'Alert not found')
    if (alert.status === 'CLOSED') throw new ApiError(409, 'Closed cases are immutable')
    if (body.status === 'CLOSED' && (!body.disposition || (body.note ?? '').trim().length < 10))
      throw new ApiError(422, 'Closing a case requires disposition and a note of at least 10 characters')
    const before = { status: alert.status, assigned_to: alert.assigned_to, disposition: alert.disposition, review_note: alert.review_note }
    alert.status = body.status
    if (body.assign_to_me) alert.assigned_to = me.id
    if (body.note) alert.review_note = body.note.trim()
    if (body.status === 'CLOSED') alert.disposition = body.disposition ?? null
    alert.updated_at = new Date().toISOString()
    log(me.email, 'ALERT_REVIEWED', 'alert', alert.id, before,
      { status: alert.status, assigned_to: alert.assigned_to, disposition: alert.disposition, review_note: alert.review_note })
    return wait(alert, 260)
  },
  rules: () => wait(rules),
  async ruleStats() {
    const counts = new Map<string, RuleStat>()
    for (const [txId, ms] of matchesByTx) {
      const at = transactions.find(t => t.id === txId)?.occurred_at ?? null
      for (const m of ms) {
        const s = counts.get(m.rule_code) ?? { rule_code: m.rule_code, matches: 0, last_matched_at: null }
        s.matches++
        if (at && (!s.last_matched_at || at > s.last_matched_at)) s.last_matched_at = at
        counts.set(m.rule_code, s)
      }
    }
    return wait([...counts.values()])
  },
  async createRule(body: RuleIn) {
    if (me.role !== 'admin') throw new ApiError(403, 'Admin access required')
    if (rules.some(r => r.code === body.code)) throw new ApiError(409, 'Rule code already exists')
    const created: Rule = { ...body, id: `r-${body.code}`, version: 1, updated_at: new Date().toISOString() }
    rules.push(created)
    log(me.email, 'RULE_CREATED', 'rule', created.id, null, { code: created.code, kind: created.kind, weight: created.weight })
    return wait(created, 300)
  },
  async updateRule(id, body: RuleUpdate) {
    if (me.role !== 'admin') throw new ApiError(403, 'Admin access required')
    const r = rules.find(x => x.id === id)
    if (!r) throw new ApiError(404, 'Rule not found')
    if (r.version !== body.expected_version) throw new ApiError(409, 'Rule version changed; reload and retry')
    const before = { name: r.name, config: r.config, weight: r.weight, enabled: r.enabled, version: r.version }
    const { expected_version: _v, ...changes } = body
    Object.assign(r, changes)
    r.version++
    r.updated_at = new Date().toISOString()
    log(me.email, 'RULE_UPDATED', 'rule', r.id, before, { name: r.name, config: r.config, weight: r.weight, enabled: r.enabled, version: r.version })
    return wait(r, 240)
  },
  audit: () => wait([...audit].sort((a, b) => b.seq - a.seq)),
  merchants: () => wait(merchants, 120),
  async verifyMerchant(name, domain) {
    const host = sanitizeDomain(domain), key = normalizeName(name)
    if (!host || key.length < 2) throw new ApiError(422, 'A valid merchant name and domain are required')
    if (merchants.some(m => m.normalized_name === key)) throw new ApiError(409, 'This merchant already has a verified domain')
    const m: Merchant = { id: `m-${host}`, name: name.trim(), normalized_name: key, domain: host, verified_by: me.email, created_at: new Date().toISOString() }
    merchants.push(m)
    log(me.email, 'MERCHANT_VERIFIED', 'merchant', m.id, null, { name: m.name, domain: host })
    return wait(m, 200)
  },
  async brandSearch(q) {
    // Canned suggestions only; the live backend queries Logo.dev server-side.
    const known = merchants.filter(m => m.normalized_name.includes(normalizeName(q)) && normalizeName(q).length > 1)
    return wait({ query: q, cached: false, candidates: known.map(m => ({ name: m.name, domain: m.domain, logo_url: `https://img.logo.dev/${m.domain}` })) }, 300)
  },
  bankConnectUrl: () => Promise.reject(new ApiError(400, 'Bank connection is not available in demo mode')),
  bankImport: () => Promise.reject(new ApiError(400, 'Bank connection is not available in demo mode')),
}
