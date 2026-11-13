import type { WatchlistBucket } from '@/services/watchlist'

/** Running totals; each bucket's step only rises when new distinct hits were recorded in it. */
export function toCumulative(buckets: WatchlistBucket[]): WatchlistBucket[] {
  const run = { total: 0, high_risk: 0, sanctions: 0, pep: 0, other: 0 }
  return buckets.map(b => { for (const k of Object.keys(run) as (keyof typeof run)[]) run[k] += b[k]; return { ...b, ...run } })
}
