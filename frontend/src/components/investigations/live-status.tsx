import { useEffect, useState } from 'react'
import { RefreshCw, TriangleAlert, WifiOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { londonShort } from '@/lib/time'
import { STALE_MS, POLL_MS, type LiveMode } from '@/hooks/use-investigations-live'
import { cn } from '@/lib/utils'

const KIND: Record<string, string> = { created: 'New investigation', assigned: 'Analyst assigned', escalated: 'Case escalated', closed: 'Case closed', opened: 'Investigation opened', note: 'Note added', updated: 'Case updated' }
const clock = (ms: number) => londonShort(new Date(ms).toISOString())

/** Connection state, last confirmed update and a stale-data warning. `lastOk` is the newest successful fetch or stream signal. */
export function LiveStatus({ mode, lastOk, fetchFailed, lastEventKind, onRefresh, refreshing }: {
  mode: LiveMode; lastOk: number | null; fetchFailed: boolean; lastEventKind?: string | null; onRefresh: () => void; refreshing: boolean
}) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(t) }, [])
  const stale = lastOk != null && now - lastOk > STALE_MS
  const live = mode === 'live' && !fetchFailed && !stale
  const label = fetchFailed ? 'Offline' : mode === 'live' ? (stale ? 'Stream silent' : 'Live') : mode === 'connecting' ? 'Connecting…' : `Polling every ${POLL_MS / 1000}s`
  return (
    <div className="flex flex-wrap items-center gap-2" role="status" aria-live="polite">
      <Badge variant="outline" className="gap-1.5 font-normal text-muted-foreground">
        {fetchFailed ? <WifiOff className="text-sev-crit" aria-hidden="true" /> : <span className={cn('size-1.5 rounded-full', live ? 'bg-ok' : 'bg-sev-med')} aria-hidden="true" />}
        <span className="text-foreground">{label}</span>
        {lastOk != null && <span>· updated <span className="tech">{clock(lastOk)}</span></span>}
      </Badge>
      {lastEventKind && <span className="hidden text-[11px] text-muted-foreground lg:inline">Latest: {KIND[lastEventKind] ?? 'Case updated'}</span>}
      {(stale || fetchFailed) && (
        <Badge variant="outline" className="gap-1.5 border-sev-med/40 bg-sev-med/10 font-normal text-sev-med"><TriangleAlert aria-hidden="true" />{fetchFailed ? 'Cannot reach the API' : 'Data may be out of date'}</Badge>
      )}
      <Button variant="outline" size="icon-sm" aria-label="Refresh now" onClick={onRefresh}><RefreshCw className={cn(refreshing && 'animate-spin')} aria-hidden="true" /></Button>
    </div>
  )
}
