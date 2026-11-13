import { request } from './http'

export type WatchlistRange = '1h' | '24h' | '7d' | '30d'
export type WatchlistCategory = 'SANCTIONS' | 'PEP' | 'OTHER'
export type WatchlistBucket = { t: string; total: number; high_risk: number; sanctions: number; pep: number; other: number }
export type WatchlistTotals = { total: number; high_risk: number; sanctions: number; pep: number; other: number; unreviewed: number; escalated: number }
export type WatchlistEvent = {
  id: string; transaction_id: string; alert_id: string | null; alert_status: string | null; detected_at: string
  category: WatchlistCategory; risk_score: number; high_risk: boolean; country: string; counterparty: string; rule_codes: string[]
}
export type WatchlistHits = {
  range: WatchlistRange; generated_at: string; window_start: string; window_end: string; bucket_seconds: number
  high_risk_threshold: number; totals: WatchlistTotals; buckets: WatchlistBucket[]; events: WatchlistEvent[]; version: string
}

const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0
const TOTAL_KEYS: (keyof WatchlistTotals)[] = ['total', 'high_risk', 'sanctions', 'pep', 'other', 'unreviewed', 'escalated']
const BUCKET_KEYS: (keyof WatchlistBucket)[] = ['total', 'high_risk', 'sanctions', 'pep', 'other']

/** Rejects malformed payloads and drops duplicate event ids; the UI never renders an unvalidated response. */
export function validateHits(raw: WatchlistHits): WatchlistHits {
  const ok = raw && Array.isArray(raw.buckets) && Array.isArray(raw.events) && raw.totals
    && TOTAL_KEYS.every(k => num(raw.totals[k])) && !Number.isNaN(Date.parse(raw.generated_at))
    && raw.buckets.every(b => !Number.isNaN(Date.parse(b.t)) && BUCKET_KEYS.every(k => num(b[k])))
  if (!ok) throw new Error('Watchlist service returned an unexpected response')
  const seen = new Set<string>()
  return { ...raw, events: raw.events.filter(e => (seen.has(e.id) ? false : (seen.add(e.id), true))) }
}

export const fetchWatchlistHits = async (range: WatchlistRange) => validateHits(await request<WatchlistHits>(`/watchlist/hits?range=${range}`))
