/**
 * ILLUSTRATIVE SAMPLE DATA for the UK risk map.
 *
 * The backend records a country per transaction but no UK location, so there is no real
 * regional fraud data to plot yet. Boundaries and populations are real (ONS / ONSdigital),
 * but alert counts, transaction counts and risk scores below are generated deterministically
 * from each area's GSS code. The UI labels this as sample data. Replace `buildSample` with an
 * API call (e.g. GET /api/geo/risk) returning `LocationRisk[]` when real data exists.
 */
export type Nation = 'England' | 'Scotland' | 'Wales' | 'Northern Ireland'
export type LocationRisk = {
  code: string; name: string; nation: Nation; population: number
  alerts: number; transactions: number; riskScore: number
}
export type PopulationFile = { areas: { code: string; name: string; nation: Nation; population: number }[] }

function rng(seed: string) {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19) }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

export function buildSample(pop: PopulationFile): LocationRisk[] {
  return pop.areas.map(a => {
    const r = rng(a.code)
    const alerts = Math.max(1, Math.round((a.population / 100_000) * (3 + r() * 13)))
    return {
      code: a.code, name: a.name, nation: a.nation, population: a.population, alerts,
      transactions: Math.round(alerts * (55 + r() * 140)),
      riskScore: Math.round(24 + Math.pow(r(), 1.3) * 62),
    }
  })
}
