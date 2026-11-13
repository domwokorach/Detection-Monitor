/**
 * County-level fraud risk, derived from real alert data.
 *
 * Geography: ONSdigital/uk-topojson `utla` layer (upper-tier/unitary authorities): counties and
 * unitaries in England, council areas in Scotland, unitaries in Wales and districts in Northern
 * Ireland. This is the closest consistent "county" equivalent across the four nations.
 *
 * Location: accounts carry an optional `la_code` (a GSS code for any local authority). District
 * codes (E07…) are resolved to the county that contains them using the boundary geometry.
 */
import * as d3 from 'd3'
import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { Account, Alert } from '@/types'

export type Nation = 'England' | 'Scotland' | 'Wales' | 'Northern Ireland'
export const RISK_THRESHOLD = 60
export type Band = 'medium-high' | 'high' | 'critical'
export type CountyProps = { areacd: string; areanm: string; start?: number; end?: number }
export type CountyArea = { code: string; name: string; nation: Nation; feature: Feature<Geometry, CountyProps>; lonlat: [number, number] }
export type GeoIndex = {
  nations: FeatureCollection<Geometry, CountyProps>
  /** Current local-authority (district / unitary) boundaries, for the finer boundary layer. */
  localAuthorities: FeatureCollection<Geometry, CountyProps>
  /** GSS code -> name and a point inside the largest part of the authority (an area anchor, not an event location). */
  areaAnchor(laCode: string): { name: string; lonlat: [number, number] } | null
  counties: CountyArea[]
  /** Resolve any local-authority GSS code to the county area containing it (null if unknown). */
  resolve(laCode: string): string | null
}
export type CountyRisk = {
  code: string; name: string; nation: Nation
  alerts: number; suspicious: number; riskScore: number; maxScore: number; lastUpdated: string
}

export const NATION_BY_PREFIX: Record<string, Nation> = { E: 'England', S: 'Scotland', W: 'Wales', N: 'Northern Ireland' }

/** 60–69 medium-high · 70–84 high · 85+ critical. Always shown with a text label, never colour alone. */
export const BAND_META: Record<Band, { label: string; range: string; color: string }> = {
  'medium-high': { label: 'Elevated', range: '60–69', color: '#4F9BD9' },
  high: { label: 'High', range: '70–84', color: '#8DD4FA' },
  critical: { label: 'Critical', range: '85+', color: '#E85D68' },
}
export function bandOf(score: number): Band | null {
  if (score >= 85) return 'critical'
  if (score >= 70) return 'high'
  if (score >= RISK_THRESHOLD) return 'medium-high'
  return null
}

function anchor(f: Feature<Geometry, CountyProps>): [number, number] {
  const g = f.geometry
  if (g.type !== 'MultiPolygon') return d3.geoCentroid(f) as [number, number]
  const parts = g.coordinates.map(c => ({ type: 'Polygon', coordinates: c }) as d3.GeoPermissibleObjects)
  return d3.geoCentroid(parts.reduce((b, p) => (d3.geoArea(p) > d3.geoArea(b) ? p : b))) as [number, number]
}

let cached: Promise<GeoIndex> | null = null
/** Loads boundaries once per page. */
export function loadGeo(): Promise<GeoIndex> {
  cached ??= (async () => {
    const res = await fetch('/data/topo.json')
    if (!res.ok) throw new Error(`Boundary file returned ${res.status}`)
    const topo = (await res.json()) as Topology
    const get = (k: string) => feature(topo, topo.objects[k] as GeometryCollection<CountyProps>) as FeatureCollection<Geometry, CountyProps>
    const counties: CountyArea[] = get('utla').features.filter(f => f.properties.end === undefined).map(f => ({
      code: f.properties.areacd, name: f.properties.areanm, nation: NATION_BY_PREFIX[f.properties.areacd[0]], feature: f, lonlat: anchor(f),
    }))
    const byCode = new Map(counties.map(c => [c.code, c]))
    const ltla = new Map(get('ltla').features.map(f => [f.properties.areacd, f]))
    const memo = new Map<string, string | null>()
    const resolve = (la: string): string | null => {
      if (byCode.has(la)) return la
      if (memo.has(la)) return memo.get(la)!
      const f = ltla.get(la)
      const hit = f ? counties.find(c => d3.geoContains(c.feature, anchor(f)))?.code ?? null : null
      memo.set(la, hit)
      return hit
    }
    const areaAnchor = (la: string) => {
      const f = ltla.get(la) ?? byCode.get(la)?.feature
      return f ? { name: f.properties.areanm, lonlat: anchor(f) } : null
    }
    const current = (fc: FeatureCollection<Geometry, CountyProps>) => ({ ...fc, features: fc.features.filter(f => f.properties.end === undefined) })
    return { nations: get('ctry'), localAuthorities: current(get('ltla')), areaAnchor, counties, resolve }
  })()
  cached.catch(() => { cached = null }) // allow a retry after a failed load
  return cached
}

/**
 * Active (not closed) alerts with risk score ≥ 60, grouped by the county of the transaction's account.
 * `riskScore` is the mean score of those alerts; `suspicious` counts their distinct transactions.
 */
export function aggregate(geo: GeoIndex, alerts: Alert[], accounts: Account[]): { counties: CountyRisk[]; unlocated: number } {
  const countyOf = new Map<string, string | null>(accounts.map(a => [a.id, a.la_code ? geo.resolve(a.la_code) : null]))
  const info = new Map(geo.counties.map(c => [c.code, c]))
  const acc = new Map<string, { scores: number[]; tx: Set<string>; last: string }>()
  let unlocated = 0
  for (const a of alerts) {
    if (a.status === 'CLOSED' || a.risk_score < RISK_THRESHOLD) continue
    const code = countyOf.get(a.transaction.account_id)
    if (!code) { unlocated++; continue }
    const e = acc.get(code) ?? { scores: [], tx: new Set<string>(), last: a.updated_at }
    e.scores.push(a.risk_score); e.tx.add(a.transaction_id)
    if (a.updated_at > e.last) e.last = a.updated_at
    acc.set(code, e)
  }
  const counties = [...acc].map(([code, e]) => ({
    code, name: info.get(code)!.name, nation: info.get(code)!.nation, alerts: e.scores.length, suspicious: e.tx.size,
    riskScore: Math.round(d3.mean(e.scores)!), maxScore: Math.max(...e.scores), lastUpdated: e.last,
  }))
  return { counties, unlocated }
}
