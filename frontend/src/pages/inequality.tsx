import { useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ErrorState, Mono, PageHeader } from '@/components/app/common'
import { NATION_COLOR, SOURCE, createInequalityChart, loadRows, split, type Chart, type Nation, type Row } from '@/lib/inequalityChart'
import { cn } from '@/lib/utils'

const NATIONS: Nation[] = ['England', 'Scotland', 'Wales', 'Northern Ireland']

export default function Inequality() {
  const host = useRef<HTMLDivElement>(null), chart = useRef<Chart | null>(null)
  const [rows, setRows] = useState<Row[]>(), [error, setError] = useState('')
  const [year, setYear] = useState<number>(0), [playing, setPlaying] = useState(false)
  const [q, setQ] = useState(''), [nations, setNations] = useState<Set<Nation>>(new Set(NATIONS)), [selected, setSelected] = useState<string | null>(null)
  const load = () => { setError(''); loadRows().then(r => { setRows(r); setYear(Math.min(...r.map(x => x.year))) }).catch(e => setError(e.message)) }
  useEffect(load, [])
  const { years, plotted, missing } = useMemo(() => (rows ? split(rows) : { years: [] as number[], plotted: [] as string[], missing: [] as Row[] }), [rows])

  useEffect(() => {
    if (!rows || !host.current || !plotted.length) return
    const c = createInequalityChart(host.current, rows, { onSelect: setSelected, onYear: setYear })
    chart.current = c
    return () => { c.destroy(); chart.current = null }
  }, [rows, plotted.length])
  useEffect(() => { chart.current?.setQuery(q) }, [q])
  useEffect(() => { chart.current?.setNations(nations) }, [nations])
  useEffect(() => {
    if (!playing || years.length < 2) return
    const t = window.setInterval(() => { const next = years[(years.indexOf(year) + 1) % years.length]; chart.current?.update(next) }, 2600)
    return () => window.clearInterval(t)
  }, [playing, year, years])

  const go = (y: number) => { setPlaying(false); chart.current?.update(y) }
  const toggle = (n: Nation) => setNations(s => { const x = new Set(s); if (x.has(n)) x.delete(n); else x.add(n); return x.size ? x : new Set(NATIONS) })
  const cell = (c: string, y: number) => rows?.find(r => r.city === c && r.year === y)
  const first = years[0], last = years[years.length - 1]

  return (
    <div className="inequality">
      <PageHeader title="Inequality in UK Cities" description={`Earnings inequality (P90 ÷ P10 hourly pay) against population · ${first ?? '—'} and ${last ?? '—'} · historical statistics, not live data`}
        actions={<>
          <div role="group" aria-label="Year" className="flex overflow-hidden rounded-[5px] border">{years.map(y => <button key={y} aria-pressed={year === y} onClick={() => go(y)} className={cn('tech h-8 px-3 text-xs transition-colors duration-200', year === y ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>{y}</button>)}</div>
          <Button size="sm" variant="outline" onClick={() => setPlaying(p => !p)} aria-pressed={playing}>{playing ? <Pause data-icon="inline-start" /> : <Play data-icon="inline-start" />}{playing ? 'Pause' : 'Play'}</Button>
        </>} />
      {error && <ErrorState message={error} onRetry={load} />}
      {!rows && !error && <Skeleton className="h-[480px]" />}
      {rows && !plotted.length && <Card className="dash-card p-6 text-sm text-muted-foreground">No city has valid data in both years, so there is nothing to plot.</Card>}
      {rows && !!plotted.length && (
        <div className="grid gap-3 lg:grid-cols-4">
          <Card className="dash-card gap-3 p-3 lg:col-span-3" style={{ background: '#0B1E33' }}>
            <div className="flex flex-wrap items-center gap-2">
              <InputGroup className="h-8 w-56"><InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon><InputGroupInput aria-label="Search cities" placeholder="Search city…" value={q} onChange={e => setQ(e.target.value)} /></InputGroup>
              <div role="group" aria-label="Filter by nation" className="flex flex-wrap gap-1.5">{NATIONS.map(n => <button key={n} aria-pressed={nations.has(n)} onClick={() => toggle(n)} className={cn('flex h-8 items-center gap-1.5 rounded-[5px] border px-2.5 text-[11px] transition-[opacity,background-color] duration-200 hover:bg-muted', !nations.has(n) && 'opacity-45')}><span className="size-2 rounded-full" style={{ background: NATION_COLOR[n] }} aria-hidden="true" />{n}</button>)}</div>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => { setSelected(null); chart.current?.select(null) }}><RotateCcw data-icon="inline-start" />Reset view</Button>
            </div>
            <div ref={host} className="w-full" />
            <p className="text-[10px] text-subtle">Hover or focus a city for detail · click to focus · drag, pinch or Ctrl/⌘ + scroll to zoom. {SOURCE}.</p>
          </Card>

          <div className="space-y-3">
            <Card className="dash-card gap-2 py-3"><CardHeader className="px-3.5"><CardTitle className="text-[13px]">How to read it</CardTitle></CardHeader>
              <CardContent className="space-y-2 px-3.5 text-[11px] text-muted-foreground">
                <p><strong className="text-foreground">P90 ÷ P10</strong>: hourly pay of the person at the 90th percentile divided by the person at the 10th. A ratio of 4× means high earners are paid four times as much per hour as low earners.</p>
                <p>Further right is a larger population. Higher is more unequal. Circles are coloured by nation.</p>
                <div className="grid grid-cols-2 gap-1">{NATIONS.map(n => <span key={n} className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: NATION_COLOR[n] }} aria-hidden="true" />{n}</span>)}</div>
              </CardContent></Card>
            <Card className="dash-card gap-2 py-3"><CardHeader className="px-3.5"><CardTitle className="text-[13px]">{selected ?? 'Selected city'}</CardTitle></CardHeader>
              <CardContent className="px-3.5 text-[11px]">{selected ? (
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">{years.flatMap(y => { const r = cell(selected, y)!; return [<dt key={`${y}a`} className="text-muted-foreground">{y} ratio</dt>, <dd key={`${y}b`} className="tech text-right">{r.ratio!.toFixed(2)}×</dd>, <dt key={`${y}c`} className="text-muted-foreground">{y} population</dt>, <dd key={`${y}d`} className="tech text-right">{r.population!.toLocaleString('en-GB')}</dd>] })}
                  <dt className="text-muted-foreground">Change</dt><dd className="tech text-right text-ice">{(cell(selected, last)!.ratio! - cell(selected, first)!.ratio!).toFixed(2)}×</dd></dl>) : <p className="text-subtle">Click a city to focus it.</p>}</CardContent></Card>
          </div>

          <Card className="dash-card gap-2 p-2 lg:col-span-3">
            <CardHeader className="px-2"><CardTitle className="text-[13px]">City data</CardTitle><CardDescription className="text-[11px]">{plotted.length} cities with valid values in both years</CardDescription></CardHeader>
            <Table><TableHeader><TableRow><TableHead>City</TableHead><TableHead>Nation</TableHead>{years.map(y => <TableHead key={y} className="text-right">{y} ratio</TableHead>)}<TableHead className="text-right">Change</TableHead>{years.map(y => <TableHead key={`p${y}`} className="hidden text-right md:table-cell">{y} pop.</TableHead>)}</TableRow></TableHeader>
              <TableBody>{[...plotted].sort((a, b) => cell(b, last)!.ratio! - cell(a, last)!.ratio!).map(c => { const d = cell(c, last)!.ratio! - cell(c, first)!.ratio!; return (
                <TableRow key={c} className={cn('cursor-pointer transition-colors duration-200', selected === c && 'bg-primary/10')} onClick={() => chart.current?.select(selected === c ? null : c)}>
                  <TableCell className="font-medium">{c}</TableCell><TableCell className="text-muted-foreground">{cell(c, first)!.nation}</TableCell>{years.map(y => <TableCell key={y} className="text-right"><Mono>{cell(c, y)!.ratio!.toFixed(2)}×</Mono></TableCell>)}
                  <TableCell className="text-right"><Mono className={d > 0 ? 'text-sev-med' : 'text-ok'}>{d > 0 ? '+' : ''}{d.toFixed(2)}×</Mono></TableCell>{years.map(y => <TableCell key={`p${y}`} className="hidden text-right md:table-cell"><Mono>{cell(c, y)!.population!.toLocaleString('en-GB')}</Mono></TableCell>)}</TableRow>) })}</TableBody></Table>
          </Card>

          <div className="space-y-3">
            <Card className="dash-card gap-2 py-3"><CardHeader className="px-3.5"><CardTitle className="text-[13px]">Missing observations</CardTitle><CardDescription className="text-[11px]">Excluded from the chart</CardDescription></CardHeader>
              <CardContent className="px-3.5"><ul className="space-y-1 text-[11px]">{[...new Set(missing.map(m => m.city))].map(c => <li key={c}><span className="font-medium">{c}</span> <span className="text-subtle">· {missing.filter(m => m.city === c).map(m => `${m.year}: ${m.status === 'suppressed' ? 'suppressed by ONS' : 'not published'}`).join(', ')}</span></li>)}</ul></CardContent></Card>
          </div>

          <Card className="dash-card gap-2 py-3 lg:col-span-4"><CardHeader className="px-3.5"><CardTitle className="text-[13px]">Method, coverage and limitations</CardTitle></CardHeader>
            <CardContent className="grid gap-3 px-3.5 text-[11px] text-muted-foreground md:grid-cols-2">
              <ul className="list-disc space-y-1 pl-4">
                <li><strong className="text-foreground">Metric:</strong> ASHE gross hourly pay (Table 8.5a), all employees, by home (place-of-residence) area. Ratio = 90th percentile ÷ 10th percentile, from the published figures.</li>
                <li><strong className="text-foreground">Years:</strong> {first} and {last}. ASHE Table 8 starts in 2002; an earlier 2001 edition is not published in this series, so 2001 is not shown.</li>
                <li><strong className="text-foreground">Population:</strong> ONS mid-year estimates (rebased), same area and year.</li>
              </ul>
              <ul className="list-disc space-y-1 pl-4">
                <li><strong className="text-foreground">Geography:</strong> each city is one published area: its local authority (not the wider city region), except London, which is the Greater London region. No ratios are averaged across areas.</li>
                <li><strong className="text-foreground">Missing values:</strong> ONS suppresses estimates that are too unreliable; Northern Ireland, including Belfast, is not covered by Table 8. These cities are excluded rather than estimated.</li>
                <li><strong className="text-foreground">Precision:</strong> ASHE is a sample survey. Estimates with a coefficient of variation above 20% are flagged in the tooltip. Local authority boundaries are not identical to the built-up city.</li>
              </ul>
            </CardContent></Card>
        </div>
      )}
    </div>
  )
}
