import * as d3 from 'd3'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { RiskEvent } from '@/types'
import { bandOf, NATION_BY_PREFIX, type Band, type CountyProps, type GeoIndex, type Nation } from '@/lib/countyRisk'

export const ALL_BANDS: Band[] = ['medium-high', 'high', 'critical']
export type Filters = { nation: 'All' | Nation; bands: Band[] }
export const DEFAULT_FILTERS: Filters = { nation: 'All', bands: ALL_BANDS }
export type Money = Record<string, number>

export type AreaRisk = { code: string; name: string; lonlat: [number, number]; countyCode: string | null; alerts: number; maxScore: number; lastUpdated: string; band: Band }
export type CountyAgg = {
  code: string; name: string; nation: Nation; alerts: number; transactions: number; maxScore: number; meanScore: number
  lastUpdated: string; exposure: Money; bands: Record<Band, number>; areas: AreaRisk[]; events: RiskEvent[]
}
export type Totals = { alerts: number; exposure: Money; maxScore: number; lastUpdated: string | null }
export type Aggregate = { counties: CountyAgg[]; areas: AreaRisk[]; byCounty: Map<string, CountyAgg>; totals: Totals; unplaced: number }

export const EMPTY_AGG: Aggregate = { counties: [], areas: [], byCounty: new Map(), totals: { alerts: 0, exposure: {}, maxScore: 0, lastUpdated: null }, unplaced: 0 }

const addMoney = (m: Money, e: RiskEvent) => { m[e.currency] = (m[e.currency] ?? 0) + Number(e.amount) }
const latest = (a: string, b: string) => (a > b ? a : b)

/** Groups located events (already >= 60) by local authority and by the county containing it. Nothing is invented. */
export function aggregate(geo: GeoIndex, events: RiskEvent[], filters: Filters): Aggregate {
  const wanted = new Set(filters.bands)
  const kept = events.filter(e => {
    const b = bandOf(e.risk_score)
    return b && wanted.has(b) && (filters.nation === 'All' || NATION_BY_PREFIX[e.la_code[0]] === filters.nation)
  })
  const areaMap = new Map<string, AreaRisk>()
  const countyMap = new Map<string, CountyAgg>()
  const totals: Totals = { alerts: 0, exposure: {}, maxScore: 0, lastUpdated: null }
  const countyInfo = new Map(geo.counties.map(c => [c.code, c]))
  let unplaced = 0
  for (const e of kept) {
    const anchor = geo.areaAnchor(e.la_code)
    if (!anchor) { unplaced++; continue }
    const countyCode = geo.resolve(e.la_code)
    const a = areaMap.get(e.la_code) ?? { code: e.la_code, name: anchor.name, lonlat: anchor.lonlat, countyCode, alerts: 0, maxScore: 0, lastUpdated: e.updated_at, band: 'medium-high' as Band }
    a.alerts++; a.maxScore = Math.max(a.maxScore, e.risk_score); a.lastUpdated = latest(a.lastUpdated, e.updated_at); a.band = bandOf(a.maxScore)!
    areaMap.set(e.la_code, a)
    totals.alerts++; totals.maxScore = Math.max(totals.maxScore, e.risk_score); addMoney(totals.exposure, e)
    totals.lastUpdated = totals.lastUpdated ? latest(totals.lastUpdated, e.updated_at) : e.updated_at
    const info = countyCode ? countyInfo.get(countyCode) : undefined
    if (!countyCode || !info) continue
    const c = countyMap.get(countyCode) ?? { code: countyCode, name: info.name, nation: info.nation, alerts: 0, transactions: 0, maxScore: 0, meanScore: 0, lastUpdated: e.updated_at, exposure: {}, bands: { 'medium-high': 0, high: 0, critical: 0 }, areas: [], events: [] }
    c.alerts++; c.transactions++; c.maxScore = Math.max(c.maxScore, e.risk_score); c.meanScore += e.risk_score
    c.lastUpdated = latest(c.lastUpdated, e.updated_at); c.bands[bandOf(e.risk_score)!]++; addMoney(c.exposure, e); c.events.push(e)
    countyMap.set(countyCode, c)
  }
  const areas = [...areaMap.values()]
  for (const c of countyMap.values()) {
    c.meanScore = Math.round(c.meanScore / c.alerts)
    c.areas = areas.filter(a => a.countyCode === c.code).sort((x, y) => y.alerts - x.alerts)
    c.events.sort((x, y) => y.risk_score - x.risk_score || (y.updated_at > x.updated_at ? 1 : -1))
  }
  const counties = [...countyMap.values()].sort((a, b) => b.maxScore - a.maxScore || b.alerts - a.alerts)
  return { counties, areas, byCounty: countyMap, totals, unplaced }
}

/** Boundary polygons carrying the live risk of each county, so the fill can be data-driven. */
export function countyCollection(geo: GeoIndex, agg: Aggregate): FeatureCollection<Geometry, { code: string; name: string; alerts: number; maxScore: number; band: Band | 'none' }> {
  return {
    type: 'FeatureCollection',
    features: geo.counties.map(c => {
      const r = agg.byCounty.get(c.code)
      return { type: 'Feature', geometry: c.feature.geometry, properties: { code: c.code, name: c.name, alerts: r?.alerts ?? 0, maxScore: r?.maxScore ?? 0, band: r ? bandOf(r.maxScore)! : 'none' } }
    }),
  }
}

/** One point per local authority with alerts. The position is the authority's anchor, an area-level location only. */
export function areaCollection(agg: Aggregate): FeatureCollection<Geometry, { code: string; name: string; alerts: number; maxScore: number; band: Band }> {
  return {
    type: 'FeatureCollection',
    features: agg.areas.map(a => ({ type: 'Feature', geometry: { type: 'Point', coordinates: a.lonlat }, properties: { code: a.code, name: a.name, alerts: a.alerts, maxScore: a.maxScore, band: a.band } })),
  }
}

export function featureBounds(f: Feature<Geometry, CountyProps>): [[number, number], [number, number]] {
  const [[w, s], [e, n]] = d3.geoBounds(f)
  return [[w, s], [e, n]]
}

/** Mask that dims everything outside the four nations (world rectangle with each nation's outline cut out). */
export function ukMask(geo: GeoIndex): Feature<Geometry> {
  const holes: number[][][] = []
  for (const f of geo.nations.features) {
    const g = f.geometry
    if (g.type === 'Polygon') holes.push(g.coordinates[0])
    else if (g.type === 'MultiPolygon') g.coordinates.forEach(p => holes.push(p[0]))
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-179, -84], [179, -84], [179, 84], [-179, 84], [-179, -84]], ...holes] } }
}

export function exposureLabel(m: Money): string {
  const gbp = m.GBP ?? 0
  const others = Object.keys(m).filter(k => k !== 'GBP')
  const text = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(gbp)
  return others.length ? `${text} + ${others.join(', ')}` : text
}
