import { describe, expect, it } from 'vitest'
import { aggregate, DEFAULT_FILTERS } from './model'
import type { GeoIndex } from '@/lib/countyRisk'
import type { RiskEvent } from '@/types'

const geo = {
  counties: [{ code: 'E08000003', name: 'Manchester', nation: 'England' }],
  areaAnchor: (c: string) => (c === 'E08000003' ? { name: 'Manchester', lonlat: [-2.24, 53.48] } : null),
  resolve: (c: string) => (c === 'E08000003' ? 'E08000003' : null),
} as unknown as GeoIndex
const ev = (id: string, score: number, la = 'E08000003', amount = '100'): RiskEvent => ({
  alert_id: id, transaction_id: id, la_code: la, risk_score: score, status: 'OPEN', amount, currency: 'GBP', direction: 'OUT',
  counterparty: 'x', occurred_at: '2026-01-01T00:00:00Z', updated_at: `2026-01-01T00:00:0${id}Z`, location_basis: 'account_local_authority',
})

describe('risk map aggregation', () => {
  it('groups by county, sums exposure and tracks max score and latest alert', () => {
    const a = aggregate(geo, [ev('1', 62), ev('2', 90, 'E08000003', '250.50')], DEFAULT_FILTERS)
    const c = a.byCounty.get('E08000003')!
    expect([c.alerts, c.maxScore, c.exposure.GBP, c.bands.critical, c.bands['medium-high']]).toEqual([2, 90, 350.5, 1, 1])
    expect(a.totals.lastUpdated).toBe('2026-01-01T00:00:02Z')
  })
  it('ignores sub-threshold scores, honours band filters and never plots unknown areas', () => {
    expect(aggregate(geo, [ev('1', 59)], DEFAULT_FILTERS).totals.alerts).toBe(0)
    expect(aggregate(geo, [ev('1', 62), ev('2', 90)], { ...DEFAULT_FILTERS, bands: ['critical'] }).totals.alerts).toBe(1)
    const a = aggregate(geo, [ev('1', 80, 'E99999999')], DEFAULT_FILTERS)
    expect([a.areas.length, a.unplaced]).toEqual([0, 1])
  })
})
