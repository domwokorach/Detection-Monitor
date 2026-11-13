import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Area, AreaChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, Bar, BarChart, XAxis, YAxis } from 'recharts'
import { ArrowDownRight, ArrowUpRight, Banknote, Gauge, Hourglass, ShieldAlert, Siren, TriangleAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Skeleton } from '@/components/ui/skeleton'
import { useCountUp } from './animated-value'
import { useApp } from '@/store/app'
import { CRITICAL, HIGH, RANGES, exposure, gbpShort, inRange, isConfirmed, series, type Range } from '@/lib/alertMetrics'
import { pctChange } from '@/lib/dashboard'
import { cn } from '@/lib/utils'
import type { Alert } from '@/types'

type Conn = { label: string; dot: string }
/** Connection health from the polling loop: Connected, Stale (no recent success), Reconnecting, Disconnected. */
function useConnection(): Conn & { updated: string } {
  const { live, loaded, lastUpdated } = useApp()
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 5000); return () => window.clearInterval(t) }, [])
  const age = lastUpdated ? now - +lastUpdated : Infinity
  const c: Conn = !loaded ? { label: 'Disconnected', dot: 'bg-sev-crit' } : live ? (age > 30_000 ? { label: 'Stale data', dot: 'bg-sev-med' } : { label: 'Connected', dot: 'bg-ok' })
    : age > 60_000 ? { label: 'Disconnected', dot: 'bg-sev-crit' } : { label: 'Reconnecting', dot: 'bg-sev-med' }
  return { ...c, updated: lastUpdated ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(lastUpdated) : '—' }
}

type Tile = { label: string; value: number; format: (n: number) => string; icon: LucideIcon; tone: string; change?: number | null; spark?: number[]; note?: string }
function Kpi({ t, i }: { t: Tile; i: number }) {
  const { shown, changed } = useCountUp(t.value)
  const good = t.change != null && t.change <= 0
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: i * 0.04 }}
      className={cn('dash-card p-3 transition-[border-color,box-shadow] duration-300', changed && 'border-ice/60 shadow-[0_0_0_1px_color-mix(in_srgb,var(--ice)_35%,transparent)]')}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"><t.icon className="size-3.5" style={{ color: t.tone }} aria-hidden="true" />{t.label}</div>
      <p className="tech mt-2 text-[24px] leading-none font-semibold tabular-nums" aria-label={`${t.label}: ${t.format(t.value)}`}><span aria-hidden="true">{t.format(shown)}</span></p>
      <div className="mt-2 flex h-6 items-end justify-between gap-2 text-[10px] text-subtle">
        {t.change !== undefined ? (t.change === null ? <span>No prior baseline</span> : <span className={cn('flex items-center gap-0.5 tnum', good ? 'text-ok' : 'text-sev-crit')}>{t.change >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}{Math.abs(t.change).toFixed(1)}%<span className="text-subtle"> vs prior</span></span>) : <span className="truncate">{t.note}</span>}
        {t.spark && <ChartContainer config={{ v: { label: t.label, color: t.tone } }} className="aspect-auto h-6 w-16 shrink-0"><LineChart data={t.spark.map(v => ({ v }))} margin={{ top: 2, bottom: 2, left: 1, right: 1 }}><YAxis hide domain={['dataMin', 'dataMax']} /><Line dataKey="v" type="monotone" stroke="var(--color-v)" strokeWidth={1.5} dot={false} animationDuration={500} /></LineChart></ChartContainer>}
      </div>
    </motion.div>
  )
}

const axis = { tickLine: false, axisLine: false, fontSize: 9.5 } as const
const activityCfg = { total: { label: 'Total', color: '#65B9EE' }, high: { label: 'High risk (60+)', color: '#F1A052' }, critical: { label: 'Critical (85+)', color: '#E85D68' } } satisfies ChartConfig
const exposureCfg = { exposure: { label: 'Suspected exposure', color: '#65B9EE' }, confirmed: { label: 'Confirmed fraud', color: '#E85D68' } } satisfies ChartConfig
const statusCfg = { n: { label: 'Alerts' } } satisfies ChartConfig

/** Live alert analytics. `alerts` is the already-filtered set, so every metric recalculates with the page filters. */
export function AlertAnalytics({ alerts, loading }: { alerts: Alert[]; loading: boolean }) {
  const [range, setRange] = useState<Range>('24h')
  const conn = useConnection()
  const { lastUpdated } = useApp()
  // Bucket boundaries follow the last successful sync so the charts only move when real data arrives.
  const now = lastUpdated ? +lastUpdated : Date.now()
  const m = useMemo(() => {
    const cur = inRange(alerts, range, now), prev = inRange(alerts, range, now, 1)
    const qual = alerts.filter(a => a.risk_score >= HIGH), s = series(alerts, range, now)
    const exp = exposure(inRange(qual, range, now)), conf = exposure(alerts.filter(isConfirmed))
    const bands = [{ k: 'Elevated 60–69', n: qual.filter(a => a.risk_score < 70).length, c: '#8DD4FA' }, { k: 'High 70–84', n: qual.filter(a => a.risk_score >= 70 && a.risk_score < CRITICAL).length, c: '#F1A052' }, { k: 'Critical 85–100', n: qual.filter(a => a.risk_score >= CRITICAL).length, c: '#E85D68' }]
    const stages = [{ k: 'New', n: alerts.filter(a => a.status === 'OPEN').length, c: '#65B9EE' }, { k: 'Under review', n: alerts.filter(a => a.status === 'IN_REVIEW').length, c: '#8DD4FA' }, { k: 'Escalated', n: alerts.filter(a => a.status === 'ESCALATED').length, c: '#E85D68' }, { k: 'Resolved', n: alerts.filter(a => a.status === 'CLOSED').length, c: '#4F6E8C' }]
    return { cur, prev, qual, s, exp, conf, bands, stages, confCount: alerts.filter(isConfirmed).length }
  }, [alerts, range, now])
  const hi = (a: Alert[]) => a.filter(x => x.risk_score >= HIGH).length, cr = (a: Alert[]) => a.filter(x => x.risk_score >= CRITICAL).length

  const tiles: Tile[] = [
    { label: 'Total Alerts', value: m.cur.length, format: n => Math.round(n).toLocaleString('en-GB'), icon: ShieldAlert, tone: '#65B9EE', change: pctChange(m.cur.length, m.prev.length) },
    { label: 'High-Risk Alerts', value: hi(m.cur), format: n => Math.round(n).toLocaleString('en-GB'), icon: TriangleAlert, tone: '#F1A052', spark: m.s.map(b => b.high) },
    { label: 'Critical Alerts', value: cr(m.cur), format: n => Math.round(n).toLocaleString('en-GB'), icon: Siren, tone: '#E85D68', note: 'Score 85 and above' },
    { label: 'Suspected Exposure', value: m.exp.total, format: gbpShort, icon: Banknote, tone: '#BFE8FF', note: `${m.exp.unique} unique txns${m.exp.excluded ? ` · ${m.exp.excluded} non-GBP excluded` : ''}` },
    { label: 'Confirmed Fraud', value: m.conf.total, format: gbpShort, icon: Gauge, tone: '#E85D68', note: `${m.confCount} confirmed case${m.confCount === 1 ? '' : 's'} · all time` },
    { label: 'Pending Investigations', value: alerts.filter(a => a.status === 'OPEN').length, format: n => Math.round(n).toLocaleString('en-GB'), icon: Hourglass, tone: '#8DD4FA', note: 'Awaiting analyst review' },
  ]
  const donutTotal = m.bands.reduce((s, b) => s + b.n, 0)

  return (
    <section aria-label="Live alert analytics" className="mb-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div role="status" className="flex items-center gap-2 rounded-[5px] border bg-card px-2 py-1 text-[11px] text-muted-foreground"><span className={cn('size-1.5 rounded-full', conn.dot, conn.label === 'Connected' && 'animate-pulse')} aria-hidden="true" />{conn.label}<span className="tech text-subtle">· last update {conn.updated} UK</span></div>
        <ToggleGroup type="single" value={range} onValueChange={v => v && setRange(v as Range)} variant="outline" size="sm" aria-label="Analytics period">{(Object.keys(RANGES) as Range[]).map(r => <ToggleGroupItem key={r} value={r} className="h-7 px-2.5 text-[11px]">{RANGES[r].label}</ToggleGroupItem>)}</ToggleGroup>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">{loading ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[92px]" />) : tiles.map((t, i) => <Kpi key={t.label} t={t} i={i} />)}</div>
      <div className="mt-2 grid gap-2 lg:grid-cols-2">
        <Card className="dash-card gap-2 py-3"><CardHeader className="px-3.5"><CardTitle className="text-[13px]">Alert Activity</CardTitle><CardDescription className="text-[11px]">Detected alerts per interval, UK time</CardDescription></CardHeader>
          <CardContent className="px-2">{loading ? <Skeleton className="h-[190px]" /> : (
            <ChartContainer config={activityCfg} className="aspect-auto h-[190px] w-full"><LineChart data={m.s} margin={{ left: 4, right: 8, top: 6 }}><CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.5} /><XAxis dataKey="label" {...axis} minTickGap={22} /><YAxis allowDecimals={false} width={26} {...axis} /><ChartTooltip content={<ChartTooltipContent />} /><ChartLegend content={<ChartLegendContent />} />
              {(['total', 'high', 'critical'] as const).map(k => <Line key={k} dataKey={k} type="monotone" stroke={`var(--color-${k})`} strokeWidth={1.6} dot={false} animationDuration={600} />)}</LineChart></ChartContainer>)}</CardContent></Card>
        <Card className="dash-card gap-2 py-3"><CardHeader className="px-3.5"><CardTitle className="text-[13px]">Financial Exposure</CardTitle><CardDescription className="text-[11px]">GBP, unique transactions · suspected vs analyst-confirmed</CardDescription></CardHeader>
          <CardContent className="px-2">{loading ? <Skeleton className="h-[190px]" /> : (
            <ChartContainer config={exposureCfg} className="aspect-auto h-[190px] w-full"><AreaChart data={m.s} margin={{ left: 4, right: 8, top: 6 }}>
              <defs>{(['exposure', 'confirmed'] as const).map(k => <linearGradient key={k} id={`fx-${k}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={`var(--color-${k})`} stopOpacity={0.35} /><stop offset="95%" stopColor={`var(--color-${k})`} stopOpacity={0} /></linearGradient>)}</defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.5} /><XAxis dataKey="label" {...axis} minTickGap={22} /><YAxis width={44} {...axis} tickFormatter={v => gbpShort(v).replace('.00', '')} />
              <ChartTooltip content={<ChartTooltipContent formatter={(v, n) => <span className="tech flex w-full justify-between gap-3"><span className="font-sans text-muted-foreground">{exposureCfg[n as keyof typeof exposureCfg]?.label}</span>{gbpShort(Number(v))}</span>} />} /><ChartLegend content={<ChartLegendContent />} />
              <Area dataKey="exposure" type="monotone" stroke="var(--color-exposure)" strokeWidth={1.6} fill="url(#fx-exposure)" animationDuration={600} /><Area dataKey="confirmed" type="monotone" stroke="var(--color-confirmed)" strokeWidth={1.6} fill="url(#fx-confirmed)" animationDuration={600} /></AreaChart></ChartContainer>)}</CardContent></Card>
        <Card className="dash-card gap-2 py-3"><CardHeader className="px-3.5"><CardTitle className="text-[13px]">Risk Distribution</CardTitle><CardDescription className="text-[11px]">Qualifying alerts, score 60 and above</CardDescription></CardHeader>
          <CardContent className="flex items-center gap-4 px-3.5">{loading ? <Skeleton className="h-[130px] w-full" /> : (<>
            <div className="relative size-[130px] shrink-0"><ChartContainer config={{ n: { label: 'Alerts' } }} className="aspect-square size-[130px]"><PieChart><ChartTooltip content={<ChartTooltipContent hideLabel nameKey="k" />} /><Pie data={m.bands.filter(b => b.n)} dataKey="n" nameKey="k" innerRadius={44} outerRadius={62} paddingAngle={2} strokeWidth={0} animationDuration={600}>{m.bands.filter(b => b.n).map(b => <Cell key={b.k} fill={b.c} />)}</Pie></PieChart></ChartContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><p className="tech text-xl leading-none font-semibold">{donutTotal}</p><p className="mt-1 text-[9.5px] text-subtle">Qualifying</p></div></div></div>
            <ul className="min-w-0 flex-1 space-y-1.5 text-[11px]">{m.bands.map(b => <li key={b.k} className="flex items-center justify-between rounded-[5px] border bg-background/40 px-2 py-1.5"><span className="flex items-center gap-1.5 text-muted-foreground"><span className="size-1.5" style={{ background: b.c }} aria-hidden="true" />{b.k}</span><span className="tech">{b.n}</span></li>)}</ul></>)}</CardContent></Card>
        <Card className="dash-card gap-2 py-3"><CardHeader className="px-3.5"><CardTitle className="text-[13px]">Alert Processing</CardTitle><CardDescription className="text-[11px]">Current workflow stage of every alert in view</CardDescription></CardHeader>
          <CardContent className="px-3.5">{loading ? <Skeleton className="h-[130px]" /> : (
            <ChartContainer config={statusCfg} className="aspect-auto h-[130px] w-full"><BarChart data={m.stages} layout="vertical" margin={{ right: 24 }} barCategoryGap={6}><XAxis type="number" hide /><YAxis type="category" dataKey="k" width={86} {...axis} fontSize={10.5} /><ChartTooltip cursor={{ fill: 'var(--muted)', opacity: 0.4 }} content={<ChartTooltipContent hideLabel />} />
              <Bar dataKey="n" radius={[0, 3, 3, 0]} animationDuration={600} label={{ position: 'right', fontSize: 10.5, className: 'fill-foreground tech' }}>{m.stages.map(s => <Cell key={s.k} fill={s.c} />)}</Bar></BarChart></ChartContainer>)}</CardContent></Card>
      </div>
    </section>
  )
}
