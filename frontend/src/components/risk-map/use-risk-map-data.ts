import { useCallback, useEffect, useRef, useState } from 'react'
import { api, refresh } from '@/store/app'
import type { RiskMapData } from '@/types'

const POLL_MS = 5000
export type Feed = { data: RiskMapData | null; status: 'loading' | 'live' | 'error'; error: string; lastSync: Date | null; reload: () => void }

/**
 * Authenticated polling of GET /api/risk-map. State only changes when the server's `version` changes, so an idle
 * map never re-uploads geometry. A changed version also refreshes the shared store so the other charts follow.
 */
export function useRiskMapData(): Feed {
  const [data, setData] = useState<RiskMapData | null>(null)
  const [status, setStatus] = useState<Feed['status']>('loading')
  const [error, setError] = useState('')
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const version = useRef<string | null>(null)
  const alive = useRef(true)

  const load = useCallback(async () => {
    try {
      const next = await api().riskMap()
      if (!alive.current) return
      if (version.current !== null && next.version !== version.current) void refresh({ silent: true })
      if (next.version !== version.current) { version.current = next.version; setData(next) }
      setStatus('live'); setError(''); setLastSync(new Date())
    } catch (e) {
      if (alive.current) { setStatus('error'); setError(e instanceof Error ? e.message : 'Risk map feed failed') }
    }
  }, [])

  useEffect(() => {
    alive.current = true
    void load()
    const t = window.setInterval(() => { if (!document.hidden) void load() }, POLL_MS)
    return () => { alive.current = false; window.clearInterval(t) }
  }, [load])

  return { data, status, error, lastSync, reload: () => void load() }
}
