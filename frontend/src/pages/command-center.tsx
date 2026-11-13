import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Area, AreaChart, Bar, CartesianGrid, ComposedChart, Line, Pie, PieChart, XAxis, YAxis } from 'recharts'
import { ArrowLeftRight, FileCheck2, Gauge, Search, ShieldAlert, TriangleAlert } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DateRangePicker, lastNDays } from '@/components/app/date-range-picker'
import { KpiCard, type Kpi } from '@/components/app/kpi-card'
import { CountUp, EmptyState, ErrorState, Mono, PageHeader, RiskBadge, StatusBadge } from '@/components/app/common'
import { FraudHeatmap } from '@/components/app/fraud-heatmap'
import { StatusChart } from '@/components/app/status-chart'
import { RiskMap, type RiskMapHandle } from '@/components/app/risk-map'
import { navigate, openAlert, refresh, useApp } from '@/store/app'
import { aggregate, loadGeo, RISK_THRESHOLD, type GeoIndex } from '@/lib/countyRisk'
import { bandCounts, dayKey, mean, pctChange, shortId } from '@/lib/dashboard'
import { money, relative } from '@/lib/format'
import { RISK_META, riskLevel } from '@/lib/risk'

const DAY = 86_400_000
const keysBetween = (from: Date, to: Date) => { const out: string[] = []; for (let t = from.getTime(); t <= to.getTime(); t += DAY) out.push(dayKey(t)); return out }
const label = (k: string) => new Date(`${k}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const countPer = <T,>(items: T[], keys: string[], at: (i: T) => string) => { const m = new Map(keys.map(k => [k, 0])); for (const i of items) { const k = dayKey(at(i)); if (m.has(k)) m.set(k, m.get(k)! + 1) } return keys.map(k => m.get(k)!) }

export default function CommandCenter() {
  const { alerts, transactions, accounts, daily, rules, overview, loaded, error, demo, live, lastUpdated } = useApp()
  const [range, setRange] = useState<DateRange | undefined>(lastNDays(7))
  const [geo, setGeo] = useState<GeoIndex>()
  const mapRef = useRef<RiskMapHandle>(null)
  useEffect(() => { loadGeo().then(setGeo).catch(() => undefined) }, [])
  const loading = !loaded && !error

  const from = range?.from ?? lastNDays(7).from!, to = range?.to ?? range?.from ?? lastNDays(7).to!
  const keys = useMemo(() => keysBetween(from, to), [from, to])
  const prevKeys = useMemo(() => keysBetween(new Date(from.getTime() - keys.length * DAY), new Date(from.getTime() - DAY)), [from, keys.length])
  const inKeys = <T,>(items: T[], at: (i: T) => string, k: string[]) => { const s = new Set(k); return items.filter(i => s.has(dayKey(at(i)))) }
  const cur = inKeys(alerts, a => a.created_at, keys), prev = inKeys(alerts, a => a.created_at, prevKeys)
  const high = (a: { risk_score: number }) => a.risk_score >= RISK_THRESHOLD
  const confirmed = alerts.filter(a => a.disposition === 'SUSPICIOUS')
  const confCur = inKeys(confirmed, a => a.updated_at, keys), confPrev = inKeys(confirmed, a => a.updated_at, prevKeys)
  const active = alerts.filter(a => a.status === 'IN_REVIEW' || a.status === 'ESCALATED')
  const activeCur = inKeys(active, a => a.created_at, keys), activePrev = inKeys(active, a => a.created_at, prevKeys)
  const dailyIn = (k: string[]) => k.map(x => daily.find(d => d.date.slice(0, 10) === x))
  const txFrom = (k: string[]) => { const w = dailyIn(k); return w.every(Boolean) ? w.reduce((s, d) => s + d!.transactions, 0) : null }
  const txCur = txFrom(keys) ?? inKeys(transactions, t => t.occurred_at, keys).length, txPrev = txFrom(prevKeys)
  const avg = (a: { risk_score: number }[]) => mean(a.map(x => x.risk_score))
  const cmp = `vs previous ${keys.length} days`

  const kpis: Kpi[] = [
    { label: 'Total Alerts', value: cur.length, icon: ShieldAlert, color: '#65B9EE', change: pctChange(cur.length, prev.length), spark: countPer(cur, keys, a => a.created_at), onOpen: () => navigate('alerts') },
    { label: 'High Risk Alerts', value: cur.filter(high).length, icon: TriangleAlert, color: '#F1A052', change: pctChange(cur.filter(high).length, prev.filter(high).length), spark: countPer(cur.filter(high), keys, a => a.created_at), onOpen: () => navigate('alerts') },
    { label: 'Active Investigations', value: active.length, icon: Search, color: '#8DD4FA', change: pctChange(activeCur.length, activePrev.length), spark: countPer(activeCur, keys, a => a.created_at), onOpen: () => navigate('cases') },
    { label: 'Suspicious Activity Reports', value: confCur.length, icon: FileCheck2, color: '#8DD4FA', change: pctChange(confCur.length, confPrev.length), spark: countPer(confCur, keys, a => a.updated_at), onOpen: () => navigate('investigations') },
    { label: 'Monitored Transactions', value: txCur, icon: ArrowLeftRight, color: '#28B99D', change: txPrev !== null ? pctChange(txCur, txPrev) : null, spark: dailyIn(keys).map(d => d?.transactions ?? 0), onOpen: () => navigate('transactions') },
    { label: 'Avg. Risk Score', value: Math.round(avg(cur)), icon: Gauge, color: '#BFE8FF', change: pctChange(avg(cur), avg(prev)), spark: keys.map(k => { const d = cur.filter(a => dayKey(a.created_at) === k); return d.length ? avg(d) : 0 }), goodWhenDown: true, onOpen: () => navigate('rules') },
  ]

  const overTime = keys.map((k, i) => ({ day: label(k), alerts: countPer(cur, keys, a => a.created_at)[i] }))
  const trend = keys.map(k => { const d = daily.find(x => x.date.slice(0, 10) === k); return { day: label(k), transactions: d?.transactions ?? 0, flagged: d?.flagged ?? 0 } })
  const bands = bandCounts(cur.map(a => a.risk_score))
  const bandTotal = bands.reduce((s, b) => s + b.value, 0)
  const county = useMemo(() => (geo ? aggregate(geo, alerts, accounts) : { counties: [], unlocated: 0 }), [geo, alerts, accounts])
  const topLocations = [...county.counties].sort((a, b) => b.alerts - a.alerts).slice(0, 7)
  const compliance = [
    { name: 'Transactions screened', n: overview?.screened ?? 0, d: overview?.transactions ?? 0 },
    { name: 'Alerts triaged', n: alerts.filter(a => a.status !== 'OPEN').length, d: alerts.length },
    { name: 'Active scoring rules', n: rules.filter(r => r.enabled).length, d: rules.length },
  ]

  const alertsCfg = { alerts: { label: 'Alerts', color: 'var(--chart-1)' } } satisfies ChartConfig
  const trendCfg = { transactions: { label: 'Transactions', color: 'var(--chart-5)' }, flagged: { label: 'Flagged', color: 'var(--chart-2)' } } satisfies ChartConfig
  const donutCfg = Object.fromEntries(bands.map(b => [b.key, { label: b.label, color: b.color }])) satisfies ChartConfig

  return (
    <div>
      <PageHeader title="Operational Overview" description="Live monitoring of alerts, risk exposure and investigation coverage"
        actions={<><Badge variant="outline" className="gap-1.5 font-normal text-muted-foreground"><span className={`size-1.5 rounded-full ${live ? 'bg-ok' : 'bg-sev-med'}`} aria-hidden="true" />{live ? 'Live' : 'Reconnecting'}{lastUpdated && <span className="tech">· {lastUpdated.toLocaleTimeString('en-GB')}</span>}</Badge><DateRangePicker value={range} onChange={setRange} /></>} />
      {error && !loaded && <ErrorState message={error} onRetry={() => refresh()} />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {loading ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[100px] rounded-[10px]" />) : kpis.map((k, i) => <KpiCard key={k.label} kpi={k} compare={cmp} index={i} />)}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-6 2xl:grid-cols-12">
        <Card className="dash-card gap-3 py-3 lg:col-span-6 2xl:col-span-5">
          <CardHeader className="px-3.5"><CardTitle className="text-[13px]">UK Risk Map</CardTitle><CardDescription className="text-[11px]">Real-time county-level fraud risk for alerts with score 60 and above</CardDescription></CardHeader>
          <CardContent className="h-[360px] px-3.5"><RiskMap ref={mapRef} locations={county.counties} unlocated={county.unlocated} /></CardContent>
        </Card>

        <div className="grid gap-3 lg:col-span-3 2xl:col-span-4" style={{ gridTemplateRows: 'auto 1fr' }}>
          <Card className="dash-card gap-2 py-3">
            <CardHeader className="px-3.5"><CardTitle className="text-[13px]">Alerts by Risk Level</CardTitle></CardHeader>
            <CardContent className="flex items-center gap-3 px-3.5">
              {loading ? <Skeleton className="h-[118px] w-full" /> : (<>
                <div className="relative size-[118px] shrink-0">
                  <ChartContainer config={donutCfg} className="aspect-square size-[118px]">
                    <PieChart><ChartTooltip content={<ChartTooltipContent hideLabel />} /><Pie data={bands.filter(b => b.value > 0).map(b => ({ name: b.key, value: b.value, fill: `var(--color-${b.key})` }))} dataKey="value" nameKey="name" innerRadius={40} outerRadius={56} paddingAngle={2} strokeWidth={0} /></PieChart>
                  </ChartContainer>
                  <div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><p className="text-lg leading-none font-semibold"><CountUp value={bandTotal} /></p><p className="mt-1 text-[9.5px] text-subtle">Total alerts</p></div></div>
                </div>
                <ul className="min-w-0 flex-1 space-y-1.5 text-[11px]">{bands.map(b => (
                  <li key={b.key} className="flex items-center justify-between gap-2 rounded border bg-background/40 px-2 py-1.5"><span className="flex items-center gap-1.5 text-muted-foreground"><span className="size-1.5 rounded-sm" style={{ background: b.color }} aria-hidden="true" />{b.label}</span><span className="tnum">{b.value} <span className="text-subtle">({bandTotal ? ((b.value / bandTotal) * 100).toFixed(1) : '0.0'}%)</span></span></li>
                ))}</ul></>)}
            </CardContent>
          </Card>
          <Card className="dash-card gap-2 py-3">
            <CardHeader className="flex-row items-start justify-between px-3.5"><CardTitle className="text-[13px]">Alerts Over Time</CardTitle><div className="text-right"><p className="text-base leading-none font-semibold tnum">{cur.length}</p><p className="mt-1 text-[9.5px] text-subtle">last {keys.length} days</p></div></CardHeader>
            <CardContent className="px-2">
              {loading ? <Skeleton className="h-[150px]" /> : (
                <ChartContainer config={alertsCfg} className="aspect-auto h-[150px] w-full">
                  <AreaChart data={overTime} margin={{ left: 4, right: 8, top: 6 }}>
                    <defs><linearGradient id="fillAlerts" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--color-alerts)" stopOpacity={0.4} /><stop offset="95%" stopColor="var(--color-alerts)" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={6} fontSize={9.5} minTickGap={16} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={24} fontSize={9.5} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area dataKey="alerts" type="monotone" stroke="var(--color-alerts)" strokeWidth={1.75} fill="url(#fillAlerts)" />
                  </AreaChart>
                </ChartContainer>)}
            </CardContent>
          </Card>
        </div>

        <Card className="dash-card gap-2 py-3 lg:col-span-3 2xl:col-span-3">
          <CardHeader className="px-3.5"><CardTitle className="text-[13px]">Top Risk Locations</CardTitle><CardDescription className="text-[11px]">Counties by active alerts at {RISK_THRESHOLD}+{demo && ' · demo data'}</CardDescription></CardHeader>
          <CardContent className="px-2.5">
            {!topLocations.length && <p className="py-8 text-center text-[11px] text-subtle">No counties at {RISK_THRESHOLD}+ right now</p>}
            <ul className="space-y-1">{topLocations.map((l, i) => { const m = RISK_META[riskLevel(l.riskScore)]; return (
              <motion.li key={l.code} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.04 }}>
                <button className="w-full rounded-md px-1.5 py-1.5 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Show ${l.name} on the map: ${l.alerts} alerts`} onClick={() => mapRef.current?.select(l.code)}>
                  <div className="flex items-baseline justify-between text-[11px]"><span className="truncate">{l.name}</span><span className="flex items-center gap-2 tnum">{l.alerts}<span className="w-14 text-right text-[10px]" style={{ color: m.color }}>{m.label}</span></span></div>
                  <Progress value={(l.alerts / topLocations[0].alerts) * 100} className="mt-1.5 h-[3px]" />
                </button>
              </motion.li>) })}</ul>
          </CardContent>
        </Card>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-6 2xl:grid-cols-12">
        <Card className="dash-card gap-2 py-3 lg:col-span-4 2xl:col-span-7">
          <CardHeader className="px-3.5"><CardTitle className="text-[13px]">Recent Alerts</CardTitle><CardDescription className="text-[11px]">Newest active cases</CardDescription></CardHeader>
          <CardContent className="px-2.5">
            {loading ? <Skeleton className="h-40" /> : !alerts.length ? <EmptyState icon={ShieldAlert} title="No alerts yet" body="Alerts appear when screened transactions cross the threshold." /> : (
              <Table>
                <TableHeader><TableRow><TableHead>Alert</TableHead><TableHead>Counterparty</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Risk</TableHead><TableHead>Status</TableHead><TableHead>When</TableHead></TableRow></TableHeader>
                <TableBody>{alerts.filter(a => a.status !== 'CLOSED').slice(0, 6).map(a => (
                  <TableRow key={a.id} className="cursor-pointer" tabIndex={0} onClick={() => openAlert(a.id)} onKeyDown={e => { if (e.key === 'Enter') openAlert(a.id) }}>
                    <TableCell><Mono>{shortId(a.id)}</Mono></TableCell><TableCell className="max-w-[10rem] truncate">{a.transaction.counterparty}</TableCell>
                    <TableCell className="text-right tnum">{money(a.transaction.amount, a.transaction.currency)}</TableCell><TableCell><RiskBadge score={a.risk_score} /></TableCell>
                    <TableCell><StatusBadge status={a.status} /></TableCell><TableCell className="text-subtle">{relative(a.created_at)}</TableCell>
                  </TableRow>))}</TableBody>
              </Table>)}
          </CardContent>
        </Card>
        <Card className="dash-card gap-2 py-3 lg:col-span-2 2xl:col-span-5">
          <CardHeader className="px-3.5"><CardTitle className="text-[13px]">Fraud Activity Trends</CardTitle><CardDescription className="text-[11px]">Monitored vs flagged transactions per day</CardDescription></CardHeader>
          <CardContent className="px-2">
            {loading ? <Skeleton className="h-[170px]" /> : (
              <ChartContainer config={trendCfg} className="aspect-auto h-[170px] w-full">
                <ComposedChart data={trend} margin={{ left: 4, right: 8, top: 6 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={9.5} minTickGap={16} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={26} fontSize={9.5} /><ChartTooltip content={<ChartTooltipContent />} /><ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="transactions" fill="var(--color-transactions)" radius={[3, 3, 0, 0]} /><Line dataKey="flagged" type="monotone" stroke="var(--color-flagged)" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ChartContainer>)}
          </CardContent>
        </Card>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-6 2xl:grid-cols-12">
        <Card className="dash-card gap-2 py-3 lg:col-span-3 2xl:col-span-5">
          <CardHeader className="px-3.5"><CardTitle className="text-[13px]">Investigation Status</CardTitle><CardDescription className="text-[11px]">Cases by workflow stage</CardDescription></CardHeader>
          <CardContent className="px-3.5">{loading ? <Skeleton className="h-[170px]" /> : <StatusChart alerts={alerts} />}</CardContent>
        </Card>
        <Card className="dash-card gap-2 py-3 lg:col-span-3 2xl:col-span-7">
          <CardHeader className="px-3.5"><CardTitle className="text-[13px]">Fraud Pattern Heatmap</CardTitle><CardDescription className="text-[11px]">Matched risk rules by day, last 7 days</CardDescription></CardHeader>
          <CardContent className="px-3.5">{loading ? <Skeleton className="h-[170px]" /> : <FraudHeatmap alerts={alerts} rules={rules} />}</CardContent>
        </Card>
      </div>

      <Card className="dash-card mt-3 gap-2 py-3">
        <CardHeader className="px-3.5"><CardTitle className="text-[13px]">Compliance Status</CardTitle><CardDescription className="text-[11px]">Operational coverage</CardDescription></CardHeader>
        <CardContent className="grid gap-4 px-3.5 sm:grid-cols-3">
          {compliance.map(c => { const pct = c.d ? (c.n / c.d) * 100 : 0; return (
            <div key={c.name}><div className="flex items-baseline justify-between text-[11px]"><span className="text-muted-foreground">{c.name}</span><span className="tnum">{pct.toFixed(1)}% <span className="text-subtle">({c.n}/{c.d})</span></span></div><Progress value={pct} className="mt-1.5 h-1" aria-label={c.name} /></div>) })}
        </CardContent>
      </Card>
    </div>
  )
}
