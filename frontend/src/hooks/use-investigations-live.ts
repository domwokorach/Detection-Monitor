import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { readEventStream, type LiveEvent } from '@/services/investigations'

export type LiveMode = 'connecting' | 'live' | 'polling'
export const POLL_MS = 10_000
export const STALE_MS = 45_000

/**
 * Keeps the investigation queries current. Primary channel: authenticated SSE fed by real audit-log entries.
 * If the stream cannot connect or drops, `mode` becomes 'polling' (callers poll at POLL_MS) while it retries with
 * back-off. Nothing here invents events: every invalidation follows a server message or a successful poll.
 */
export function useInvestigationsLive(enabled: boolean) {
  const qc = useQueryClient()
  const [mode, setMode] = useState<LiveMode>('connecting')
  const [lastSignal, setLastSignal] = useState<number | null>(null)
  const [lastEvent, setLastEvent] = useState<LiveEvent | null>(null)
  const cursor = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) return
    const ctl = new AbortController()
    let attempt = 0
    const run = async () => {
      while (!ctl.signal.aborted) {
        try {
          await readEventStream(ctl.signal, cursor.current, (event, data) => {
            if (event === 'open') { attempt = 0; setMode('live'); setLastSignal(Date.now()); void qc.invalidateQueries({ queryKey: ['investigations'] }) } // catch up after (re)connect
            else if (event === 'hello' || event === 'heartbeat') { cursor.current = data.cursor ?? cursor.current; setLastSignal(Date.now()) }
            else if (event === 'investigation') { cursor.current = data.seq; setLastSignal(Date.now()); setLastEvent(data); void qc.invalidateQueries({ queryKey: ['investigations'] }) }
            else if (event === 'unauthorised') ctl.abort()
          })
        } catch (e) { if (ctl.signal.aborted) return; if (e instanceof Error && 'status' in e && (e as { status: number }).status === 401) return }
        if (ctl.signal.aborted) return
        setMode('polling')
        await new Promise(r => setTimeout(r, Math.min(30_000, 1000 * 2 ** attempt++)))
      }
    }
    void run()
    return () => ctl.abort()
  }, [enabled, qc])

  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: ['investigations'] }), [qc])
  return { mode, lastSignal, lastEvent, refresh }
}
