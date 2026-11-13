import type { Alert } from '@/types'

export type Range = '1h' | '24h' | '7d' | '30d'
export const RANGES: Record<Range, { label: string; ms: number; buckets: number }> = {
  '1h': { label: '1H', ms: 3_600_000, buckets: 12 },
  '24h': { label: '24H', ms: 86_400_000, buckets: 24 },
  '7d': { label: '7D', ms: 7 * 86_400_000, buckets: 7 },
  '30d': { label: '30D', ms: 30 * 86_400_000, buckets: 30 },
}
export const HIGH = 60, CRITICAL = 85

const gbp = (a: Alert) => a.transaction.currency === 'GBP'
/** A confirmed case: closed by an analyst with a suspicious disposition. */
export const isConfirmed = (a: Alert) => a.status === 'CLOSED' && a.disposition === 'SUSPICIOUS'

/** Sum GBP value of unique transactions (a transaction hit by several alerts counts once). Non-GBP is counted, not converted. */
export function exposure(alerts: Alert[]) {
  const seen = new Set<string>(); let total = 0, excluded = 0
  for (const a of alerts) {
    if (seen.has(a.transaction_id)) continue
    seen.add(a.transaction_id)
    if (gbp(a)) total += Number(a.transaction.amount); else excluded++
  }
  return { total, excluded, unique: seen.size }
}

export type Bucket = { t: number; label: string; total: number; high: number; critical: number; exposure: number; confirmed: number }
const fmt = (range: Range) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', ...(range === '7d' || range === '30d' ? { day: 'numeric', month: 'short' } : { hour: '2-digit', minute: '2-digit' }) })

/** Time-bucketed series ending at `now`. Exposure/confirmed dedupe by transaction (earliest alert wins its bucket). */
export function series(alerts: Alert[], range: Range, now: number): Bucket[] {
  const { ms, buckets } = RANGES[range], size = ms / buckets, start = now - ms, f = fmt(range)
  const out: Bucket[] = Array.from({ length: buckets }, (_, i) => ({ t: start + (i + 1) * size, label: f.format(start + (i + 1) * size - size / 2), total: 0, high: 0, critical: 0, exposure: 0, confirmed: 0 }))
  const idx = (t: number) => Math.min(buckets - 1, Math.floor((t - start) / size))
  const seenX = new Set<string>(), seenC = new Set<string>()
  for (const a of [...alerts].sort((x, y) => +new Date(x.created_at) - +new Date(y.created_at))) {
    const t = +new Date(a.created_at)
    if (t >= start && t <= now) {
      const b = out[idx(t)]; b.total++; if (a.risk_score >= HIGH) b.high++; if (a.risk_score >= CRITICAL) b.critical++
      if (a.risk_score >= HIGH && gbp(a) && !seenX.has(a.transaction_id)) { seenX.add(a.transaction_id); b.exposure += Number(a.transaction.amount) }
    }
    const u = +new Date(a.updated_at)
    if (isConfirmed(a) && gbp(a) && u >= start && u <= now && !seenC.has(a.transaction_id)) { seenC.add(a.transaction_id); out[idx(u)].confirmed += Number(a.transaction.amount) }
  }
  return out
}

export const inRange = (alerts: Alert[], range: Range, now: number, offset = 0) => {
  const { ms } = RANGES[range], end = now - offset * ms, start = end - ms
  return alerts.filter(a => { const t = +new Date(a.created_at); return t >= start && t <= end })
}

/** £12,450.00 below one million, £1.25M above. */
export function gbpShort(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `£${(n / 1_000_000).toFixed(2)}M`
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
