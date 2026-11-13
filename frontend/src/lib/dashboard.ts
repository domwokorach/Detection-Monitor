import type { Account, Alert, Daily, Rule, Transaction } from '@/types'
import { riskLevel, RISK_META, type RiskLevel } from './risk'

const DAY = 86_400_000
const pad = (n: number) => String(n).padStart(2, '0')
export const dayKey = (d: Date | string | number) => { const x = new Date(d); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}` }

/** The last `n` local calendar days ending today, offset back by `offset` days. */
export function lastDays(n: number, offset = 0): string[] {
  const out: string[] = []
  for (let i = n - 1 + offset; i >= offset; i--) out.push(dayKey(Date.now() - i * DAY))
  return out
}

export function countBy<T>(items: T[], keys: string[], at: (i: T) => string, weight: (i: T) => number = () => 1): number[] {
  const m = new Map(keys.map(k => [k, 0]))
  for (const i of items) { const k = dayKey(at(i)); if (m.has(k)) m.set(k, m.get(k)! + weight(i)) }
  return keys.map(k => m.get(k)!)
}
export function meanBy<T>(items: T[], keys: string[], at: (i: T) => string, val: (i: T) => number): (number | null)[] {
  const sum = new Map<string, [number, number]>(keys.map(k => [k, [0, 0]]))
  for (const i of items) { const k = dayKey(at(i)); const s = sum.get(k); if (s) { s[0] += val(i); s[1]++ } }
  return keys.map(k => { const [t, c] = sum.get(k)!; return c ? t / c : null })
}
export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
export const mean = (a: number[]) => (a.length ? sum(a) / a.length : 0)
/** Percentage change, or null when the earlier period is empty (never invent a baseline). */
export const pctChange = (cur: number, prev: number): number | null => (prev > 0 ? ((cur - prev) / prev) * 100 : null)

export const shortId = (id: string, prefix = 'ALT') => `${prefix}-${id.replace(/-/g, '').slice(-5).toUpperCase()}`
export const clock = (iso: string) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(iso))

/** Compact "2m ago" style time used in dense tables. */
export function ago(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 45) return 'Just now'
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  if (s < 86400) return `${Math.round(s / 3600)}h ago`
  return `${Math.round(s / 86400)}d ago`
}

export type Slice = { key: RiskLevel; label: string; value: number; color: string }
export function bandCounts(scores: number[]): Slice[] {
  const c: Record<RiskLevel, number> = { critical: 0, high: 0, medium: 0, low: 0 }
  for (const s of scores) c[riskLevel(s)]++
  return (['critical', 'high', 'medium', 'low'] as RiskLevel[]).map(key => ({ key, label: RISK_META[key].label, value: c[key], color: RISK_META[key].color }))
}

/** Highest transaction risk per account → customer risk band. Accounts with no screened activity count as low. */
export function customerScores(accounts: Account[], txs: Transaction[]): number[] {
  const max = new Map<string, number>()
  for (const t of txs) max.set(t.account_id, Math.max(max.get(t.account_id) ?? 0, t.risk_score))
  return accounts.map(a => max.get(a.id) ?? 0)
}

export const watchlistCountries = (rules: Rule[]): Set<string> =>
  new Set(rules.filter(r => r.kind === 'COUNTRY_WATCHLIST' && r.enabled).flatMap(r => (r.config.countries as string[]) ?? []))

export const dailyWindow = (daily: Daily[], keys: string[]) => keys.map(k => daily.find(d => d.date.slice(0, 10) === k))
export const alertAt = (a: Alert) => a.created_at
