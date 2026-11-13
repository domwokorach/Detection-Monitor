import { useEffect, useRef, useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { readSse } from '@/services/investigations'
import { fetchWatchlistHits, type WatchlistRange } from '@/services/watchlist'

export type WatchlistLink = 'connecting' | 'live' | 'polling' | 'disconnected'
export const WATCHLIST_POLL_MS = 10_000

/**
 * Authoritative watchlist hits for one range. Primary channel is authenticated SSE; a `changed` frame triggers a refetch.
 * If the stream is down the query polls instead. Data only ever comes from the API: on failure the last good response
 * stays on screen and the link state turns 'disconnected'.
 */
export function useWatchlistHits(range: WatchlistRange, enabled: boolean) {
  const qc = useQueryClient()
  const [stream, setStream] = useState<'connecting' | 'live' | 'down'>('connecting')
  const newest = useRef(0)

  useEffect(() => {
    if (!enabled) return
    const ctl = new AbortController()
    ;(async () => {
      let attempt = 0
      while (!ctl.signal.aborted) {
        try {
          await readSse('/api/watchlist/stream', ctl.signal, event => {
            if (event === 'open') { attempt = 0; setStream('live'); void qc.invalidateQueries({ queryKey: ['watchlist'] }) }
            else if (event === 'changed') void qc.invalidateQueries({ queryKey: ['watchlist'] })
            else if (event === 'unauthorised') ctl.abort()
          })
        } catch (e) { if (ctl.signal.aborted || (e instanceof Error && 'status' in e && (e as { status: number }).status === 401)) return }
        if (ctl.signal.aborted) return
        setStream('down')
        await new Promise(r => setTimeout(r, Math.min(30_000, 1000 * 2 ** attempt++)))
      }
    })()
    return () => ctl.abort()
  }, [enabled, qc])

  const query = useQuery({
    queryKey: ['watchlist', range], enabled, placeholderData: keepPreviousData,
    queryFn: async () => {
      const data = await fetchWatchlistHits(range)
      const at = Date.parse(data.generated_at)
      if (at < newest.current - 60_000) throw new Error('Stale watchlist response ignored')
      newest.current = Math.max(newest.current, at)
      return data
    },
    refetchInterval: stream === 'live' ? false : WATCHLIST_POLL_MS,
  })

  const link: WatchlistLink = query.isError && query.isRefetchError ? 'disconnected' : stream === 'live' ? 'live' : stream === 'down' ? 'polling' : 'connecting'
  return { ...query, link, lastUpdated: query.dataUpdatedAt ? new Date(query.dataUpdatedAt) : null }
}
