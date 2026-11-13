import { describe, expect, it } from 'vitest'
import { toCumulative } from '@/lib/watchlistChart'
import { validateHits, type WatchlistHits } from '@/services/watchlist'

const b = (t: string, total: number, high_risk = 0) => ({ t, total, high_risk, sanctions: 0, pep: 0, other: total })

describe('toCumulative', () => {
  it('only rises where new hits were recorded and never decreases', () => {
    const out = toCumulative([b('2026-01-01T00:00:00Z', 0), b('2026-01-01T00:15:00Z', 2, 1), b('2026-01-01T00:30:00Z', 0), b('2026-01-01T00:45:00Z', 1)])
    expect(out.map(p => p.total)).toEqual([0, 2, 2, 3])
    expect(out.map(p => p.high_risk)).toEqual([0, 1, 1, 1])
  })
})

describe('validateHits', () => {
  const base = (): WatchlistHits => ({ range: '24h', generated_at: '2026-01-01T00:00:00Z', window_start: '', window_end: '', bucket_seconds: 900, high_risk_threshold: 60,
    totals: { total: 1, high_risk: 0, sanctions: 0, pep: 0, other: 1, unreviewed: 0, escalated: 0 }, buckets: [b('2026-01-01T00:00:00Z', 1)], events: [], version: '1' })
  it('drops duplicate event ids', () => {
    const e = { id: 'a', transaction_id: 'a', alert_id: null, alert_status: null, detected_at: '2026-01-01T00:00:00Z', category: 'OTHER' as const, risk_score: 10, high_risk: false, country: 'ZZ', counterparty: 'x', rule_codes: [] }
    expect(validateHits({ ...base(), events: [e, e] }).events).toHaveLength(1)
  })
  it('rejects malformed payloads', () => {
    expect(() => validateHits({ ...base(), totals: { ...base().totals, total: -1 } })).toThrow()
    expect(() => validateHits({ ...base(), buckets: [{ ...b('nope', 1) }] })).toThrow()
  })
})
