import { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { ArrowUpRight, Eye, ShieldAlert, TriangleAlert, Siren, Sigma } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ChartContainer, ChartLegend, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { AnimatedValue } from '@/components/app/animated-value'
import { EmptyState, ErrorState } from '@/components/app/common'
import { useWatchlistHits, type WatchlistLink } from '@/hooks/use-watchlist-hits'
import { openAlert, useApp } from '@/store/app'
import { cn } from '@/lib/utils'
import { toCumulative } from '@/lib/watchlistChart'
import type { WatchlistEvent, WatchlistRange } from '@/services/watchlist'

type SeriesKey = 'total' | 'high_risk' | 'sanctions' | 'pep' | 'other'
type Mode = 'cumulative' | 'interval'

const RANGES: { value: WatchlistRange; label: string; aria: string }[] = [
  { value: '1h', label: '1H', aria: 'Last hour' }, { value: '24h', label: '24H', aria: 'Last 24 hours' },
  { value: '7d', label: '7D', aria: 'Last 7 days' }, { value: '30d', label: '30D', aria: 'Last 30 days' },
]
const SERIES: { key: SeriesKey; label: string; color: string; dash?: string; width: number }[] = [
  { key: 'total', label: 'Total hits', color: '#65B9EE', width: 2.25 },
  { key: 'high_risk', label: 'High-risk', color: '#BFE8FF', width: 1.5 },
  { key: 'sanctions', label: 'Sanctions', color: '#E85D68', width: 1.25 },
  { key: 'pep', label: 'PEP', color: '#D9AA56', width: 1.25 },
  { key: 'other', label: 'Other', color: '#8CA2BA', dash: '3 3', width: 1.25 },
]
const config = Object.fromEntries(SERIES.map(s => [s.key, { label: s.label, color: s.color }])) satisfies ChartConfig

const LINK_META: Record<WatchlistLink, { label: string; dot: string }> = {
  live: { label: 'Live', dot: 'bg-ok' }, polling: { label: 'Polling', dot: 'bg-sev-med' },
  connecting: { label: 'Connecting', dot: 'bg-subtle' }, disconnected: { label: 'Disconnected', dot: 'bg-sev-crit' },
}

const tickFormat = (range: WatchlistRange) => (t: string) => range === '1h' || range === '24h'
  ? new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(t))
  : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(new Date(t))
const fullTime = (t: string) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(t))
const clock = (d: Date) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(d)

function Kpi({ label, value, icon: Icon, tone, index }: { label: string; value: number; icon: LucideIcon; tone: string; index: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.05 }}>
      <Card className="dash-card gap-0 p-3.5 ring-0" aria-label={`${label}: ${value}`}>
        <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
          <span className="grid size-6 place-items-center rounded-[5px] border bg-secondary" style={{ color: tone }}><Icon className="size-[13px]" strokeWidth={1.75} aria-hidden="true" /></span>{label}
        </div>
        <p className="mt-2.5 text-[26px] leading-none font-semibold tracking-tight text-foreground"><AnimatedValue value={value} format={n => Math.round(n).toLocaleString('en-GB')} /></p>
      </Card>
    </motion.div>
  )
}

export function WatchlistHitsStepChart() {
  const { demo, user } = useApp()
  const reduced = useReducedMotion()
  const [range, setRange] = useState<WatchlistRange>('24h')
  const [mode, setMode] = useState<Mode>('cumulative')
  const [visible, setVisible] = useState<Set<SeriesKey>>(new Set(['total', 'high_risk']))
  const [picked, setPicked] = useState<string | null>(null)
  const { data, isPending, isError, isPlaceholderData, link, lastUpdated, refetch } = useWatchlistHits(range, !!user && !demo)

  const points = useMemo(() => (data ? (mode === 'cumulative' ? toCumulative(data.buckets) : data.buckets) : []), [data, mode])
  const step = data?.bucket_seconds ?? 0
  const pickedEvents = useMemo<WatchlistEvent[]>(() => {
    if (!data) return []
    if (!picked) return data.events.slice(0, 6)
    const from = Date.parse(picked)
    return data.events.filter(e => { const t = Date.parse(e.detected_at); return t >= from && t < from + step * 1000 })
  }, [data, picked, step])

  const toggle = (k: SeriesKey) => setVisible(v => { const n = new Set(v); if (n.has(k)) { if (n.size > 1) n.delete(k) } else n.add(k); return n })
  const status = LINK_META[link]
  const duration = reduced ? 0 : 400

  return (
    <section className="wh-scope space-y-3" aria-label="Watchlist hits">
      {demo ? (
        <Card className="dash-card p-4 ring-0"><EmptyState icon={Eye} title="Live watchlist feed unavailable in demo mode" body="Watchlist hit analytics only render authoritative data from the monitoring API. Sign in to a live backend to see them." /></Card>
      ) : isError && !data ? (
        <ErrorState message="Watchlist hits could not be loaded." onRetry={() => void refetch()} />
      ) : (<>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {isPending || !data ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[88px]" />) : (<>
            <Kpi index={0} label="Total Hits" value={data.totals.total} icon={Sigma} tone="#65B9EE" />
            <Kpi index={1} label="High-Risk Hits" value={data.totals.high_risk} icon={ShieldAlert} tone="#E85D68" />
            <Kpi index={2} label="Unreviewed Matches" value={data.totals.unreviewed} icon={Eye} tone="#D9AA56" />
            <Kpi index={3} label="Escalated Matches" value={data.totals.escalated} icon={Siren} tone="#F1A052" />
          </>)}
        </div>

        <Card className="dash-card gap-3 py-3.5 ring-0">
          <CardHeader className="flex flex-col gap-2 px-3.5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-[13px]">Watchlist Hits</CardTitle>
              <CardDescription className="text-[11px]">{mode === 'cumulative' ? 'Cumulative distinct hits, rising only when a new match is recorded' : 'Distinct hits recorded per interval'}</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ToggleGroup type="single" value={mode} onValueChange={v => v && setMode(v as Mode)} variant="outline" size="sm" spacing={0} aria-label="Chart mode">
                <ToggleGroupItem value="cumulative" className="rounded-[5px] px-2 text-[11px]">Cumulative</ToggleGroupItem>
                <ToggleGroupItem value="interval" className="rounded-[5px] px-2 text-[11px]">Per interval</ToggleGroupItem>
              </ToggleGroup>
              <ToggleGroup type="single" value={range} onValueChange={v => { if (v) { setRange(v as WatchlistRange); setPicked(null) } }} variant="outline" size="sm" spacing={0} aria-label="Time range">
                {RANGES.map(r => <ToggleGroupItem key={r.value} value={r.value} aria-label={r.aria} className="tech rounded-[5px] px-2 text-[11px]">{r.label}</ToggleGroupItem>)}
              </ToggleGroup>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 px-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground" role="status" aria-live="polite">
              <span className="inline-flex items-center gap-1.5 rounded-[5px] border px-2 py-0.5">
                <span className={cn('size-1.5 rounded-full', status.dot, link === 'live' && !reduced && 'animate-pulse')} aria-hidden="true" />{status.label}
              </span>
              <span className="tech">{lastUpdated ? `Updated ${clock(lastUpdated)}` : 'Awaiting first update'}</span>
            </div>
            {link === 'disconnected' && (
              <div className="flex items-center justify-between gap-3 rounded-[5px] border border-sev-crit/40 bg-sev-crit/10 px-3 py-2 text-[11px]" role="alert">
                <span className="flex items-center gap-2"><TriangleAlert className="size-3.5 text-sev-crit" aria-hidden="true" />Connection lost. Showing the last confirmed data{lastUpdated ? ` from ${clock(lastUpdated)}` : ''}.</span>
                <Button size="xs" variant="outline" className="rounded-[5px]" onClick={() => void refetch()}>Retry</Button>
              </div>)}

            {isPending || !data ? <Skeleton className="h-[260px]" /> : data.totals.total === 0 ? (
              <EmptyState icon={Eye} title="No watchlist hits in this window" body="Hits appear here as soon as a transaction matches an active watchlist rule." />
            ) : (
              <div className={cn('wh-well rounded-[5px] border p-2 transition-opacity duration-300', isPlaceholderData && 'opacity-60')}>
                <ChartContainer config={config} className="aspect-auto h-[260px] w-full">
                  <LineChart accessibilityLayer data={points} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
                    onClick={s => { const label = (s as { activeLabel?: string | number } | null)?.activeLabel; if (label != null) setPicked(String(label)) }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.55} strokeDasharray="2 4" />
                    <XAxis dataKey="t" tickLine={false} axisLine={false} tickMargin={8} minTickGap={36} tickFormatter={tickFormat(range)} className="tech text-[10px]" />
                    <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={44} className="tech text-[10px]" />
                    <ChartTooltip cursor={{ stroke: 'var(--primary)', strokeOpacity: 0.35 }}
                      content={<ChartTooltipContent className="rounded-[5px] text-[11px]" labelFormatter={(_, p) => (p?.[0]?.payload?.t ? fullTime(p[0].payload.t) : '')}
                        formatter={(value, name) => (
                          <div className="flex w-full items-center justify-between gap-4"><span className="text-muted-foreground">{config[name as SeriesKey]?.label}</span><span className="tech font-medium text-foreground">{Number(value).toLocaleString('en-GB')}</span></div>)} />} />
                    <ChartLegend verticalAlign="bottom" content={() => (
                      <div className="flex flex-wrap items-center justify-center gap-1.5 pt-3" role="group" aria-label="Series">
                        {SERIES.map(s => (
                          <button key={s.key} type="button" aria-pressed={visible.has(s.key)} onClick={() => toggle(s.key)}
                            className={cn('inline-flex items-center gap-1.5 rounded-[5px] border px-2 py-1 text-[11px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring', visible.has(s.key) ? 'text-foreground' : 'text-subtle opacity-60')}>
                            <span className="h-0.5 w-3" style={{ background: visible.has(s.key) ? s.color : 'currentColor' }} aria-hidden="true" />{s.label}
                            <span className="tech text-muted-foreground">{(data.totals[s.key] ?? 0).toLocaleString('en-GB')}</span>
                          </button>))}
                      </div>)} />
                    {SERIES.filter(s => visible.has(s.key)).map(s => (
                      <Line key={s.key} dataKey={s.key} type="stepAfter" stroke={`var(--color-${s.key})`} strokeWidth={s.width} strokeDasharray={s.dash} dot={false}
                        activeDot={{ r: 3.5, strokeWidth: 0 }} isAnimationActive={!reduced} animationDuration={duration} animationEasing="ease-out" />))}
                  </LineChart>
                </ChartContainer>
              </div>)}

            {data && data.totals.total > 0 && (
              <div>
                <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{picked ? <>Hits at <span className="tech text-foreground">{fullTime(picked)}</span></> : 'Latest hits'}</span>
                  {picked && <button type="button" className="rounded-[5px] px-1 text-primary underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setPicked(null)}>Show latest</button>}
                </div>
                {pickedEvents.length === 0 ? <p className="rounded-[5px] border px-3 py-3 text-center text-[11px] text-subtle">No hits recorded in this interval.</p> : (
                  <ul className="divide-y rounded-[5px] border">
                    {pickedEvents.map(e => (
                      <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[11px]">
                        <div className="min-w-0">
                          <p className="truncate text-foreground">{e.counterparty} <span className="tech text-muted-foreground">· {e.country}</span></p>
                          <p className="tech text-subtle">{fullTime(e.detected_at)} · {e.category.toLowerCase()} · risk {e.risk_score}</p>
                        </div>
                        {e.alert_id
                          ? <Button size="xs" variant="outline" className="rounded-[5px]" onClick={() => openAlert(e.alert_id!)} aria-label={`Open investigation for ${e.counterparty}`}>Investigate<ArrowUpRight data-icon="inline-end" /></Button>
                          : <span className="text-subtle">No alert raised</span>}
                      </li>))}
                  </ul>)}
              </div>)}
          </CardContent>
        </Card>
      </>)}
    </section>
  )
}
