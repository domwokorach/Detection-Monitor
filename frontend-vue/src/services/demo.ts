/**
 * DEMO DATA ONLY. Used when the user explicitly chooses "Explore demo data" on the
 * login screen (typically because the FastAPI backend is not running). Every write
 * lives in memory and is lost on reload. The UI shows a persistent "Demo data" banner.
 */
import type {
  Account, Alert, AlertDetail, AlertReview, Audit, Backend, Daily, Match, Overview, Rule, RuleIn,
  RuleStat, RuleUpdate, Session, Transaction, User,
} from '@/types'
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
  'Courier Direct', 'Training Example LLC', 'Harbour Logistics', 'Online shopping', 'Software Subscription']
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
    risk_score: tx.risk_score, assigned_to: null, disposition: null, review_note: null,
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
  log('analyst@demo.local', 'TRANSACTION_INGESTED', 'transaction', tx.id, null, { external_id: tx.external_id, amount: tx.amount }, at)
  screen(tx)
}

for (let i = 0; i < 160; i++) addTransaction(now - 7 * DAY + (i / 160) * 7 * DAY - rnd() * 3_600_000)
// A deterministic burst so velocity and outflow rules visibly fire.
for (let i = 0; i < 4; i++) addTransaction(now - 18 * 60_000 + i * 120_000, i === 3)
transactions.sort((a, b) => +new Date(a.occurred_at) - +new Date(b.occurred_at))
audit.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)).forEach((e, i) => { e.seq = i + 1 })
alerts.slice(0, 6).forEach((a, i) => { if (i % 2) a.status = 'IN_REVIEW' })

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
  bankConnectUrl: () => Promise.reject(new ApiError(400, 'Bank connection is not available in demo mode')),
  bankImport: () => Promise.reject(new ApiError(400, 'Bank connection is not available in demo mode')),
}
