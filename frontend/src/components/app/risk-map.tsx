import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { Maximize2, Minus, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { BAND_META, RISK_THRESHOLD, bandOf, loadGeo, type CountyArea, type CountyRisk, type GeoIndex, type Nation } from '@/lib/countyRisk'
import { cn } from '@/lib/utils'

type Row = CountyArea & { loc?: CountyRisk }
const NATIONS: { id: 'All' | Nation; label: string }[] = [{ id: 'All', label: 'All UK' }, { id: 'England', label: 'England' }, { id: 'Scotland', label: 'Scotland' }, { id: 'Wales', label: 'Wales' }, { id: 'Northern Ireland', label: 'N. Ireland' }]
const PREFIX: Record<string, Nation> = { E: 'England', S: 'Scotland', W: 'Wales', N: 'Northern Ireland' }
export type RiskMapHandle = { select: (code: string) => void }

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const dur = (ms: number) => (reduced() ? 0 : ms)
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })

/**
 * Interactive D3 map of UK county-equivalent areas. Only alerts with risk_score >= 60 are plotted
 * (the filtering lives in lib/countyRisk.aggregate). Fills + glowing markers tween as data changes.
 */
export const RiskMap = forwardRef<RiskMapHandle, { locations: CountyRisk[]; unlocated?: number; className?: string }>(function RiskMap({ locations, unlocated = 0, className }, ref) {
  const box = useRef<HTMLDivElement>(null)
  const svgEl = useRef<SVGSVGElement>(null)
  const [geo, setGeo] = useState<GeoIndex>()
  const [error, setError] = useState('')
  const [nation, setNation] = useState<'All' | Nation>('All')
  const [hover, setHover] = useState<{ row: Row; x: number; y: number } | null>(null)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [active, setActive] = useState(0)
  const byCode = useMemo(() => new Map(locations.map(l => [l.code, l])), [locations])
  const maxSusp = useMemo(() => Math.max(1, ...locations.map(l => l.suspicious)), [locations])

  // d3 state kept in a ref: the SVG is imperative, React owns only the chrome around it.
  const d = useRef({
    rows: [] as Row[], k: 1, w: 0, h: 0, selected: null as string | null, previous: new Map<string, string>(), nation: 'All' as 'All' | Nation, built: false,
    projection: d3.geoMercator(), radius: d3.scaleSqrt().range([0, 16]), zoom: d3.zoom<SVGSVGElement, unknown>().scaleExtent([1, 16]),
    areas: undefined as d3.Selection<SVGPathElement, Row, SVGGElement, unknown> | undefined, markers: undefined as d3.Selection<SVGCircleElement, Row, SVGGElement, unknown> | undefined,
    nationPaths: undefined as d3.Selection<SVGPathElement, GeoIndex['nations']['features'][number], SVGGElement, unknown> | undefined,
  })
  const path = useMemo(() => d3.geoPath(d.current.projection), [])
  const colour = (r: Row) => (r.loc ? BAND_META[bandOf(r.loc.riskScore) ?? 'medium-high'].color : 'none')

  useEffect(() => { loadGeo().then(setGeo).catch(e => setError(e instanceof Error ? e.message : 'Could not load UK boundaries')) }, [])

  const markerR = useCallback((r: Row) => (r.loc ? d.current.radius(r.loc.suspicious) / Math.sqrt(d.current.k) : 0) * (d.current.nation === 'All' || r.nation === d.current.nation ? 1 : 0.5), [])
  const sizeStrokes = useCallback(() => {
    const s = d.current
    s.markers?.attr('r', markerR).attr('stroke-width', 1 / Math.sqrt(s.k))
    s.areas?.attr('stroke-width', 0.45 / s.k)
    s.nationPaths?.attr('stroke-width', 0.9 / s.k)
  }, [markerR])

  const layout = useCallback(() => {
    const s = d.current, el = box.current!
    if (!geo) return
    s.w = el.clientWidth; s.h = el.clientHeight
    d3.select(svgEl.current!).attr('viewBox', `0 0 ${s.w} ${s.h}`)
    s.projection.fitExtent([[10, 8], [s.w - 10, s.h - 8]], geo.nations)
    s.radius.range([0, Math.max(9, Math.min(20, Math.min(s.w, s.h) * 0.05))])
    s.zoom.extent([[0, 0], [s.w, s.h]]).translateExtent([[-s.w * 0.15, -s.h * 0.15], [s.w * 1.15, s.h * 1.15]])
    s.nationPaths?.attr('d', path)
    s.areas?.attr('d', r => path(r.feature))
    s.markers?.each(function (r) { const p = s.projection(r.lonlat)!; d3.select(this).attr('cx', p[0]).attr('cy', p[1]) })
    sizeStrokes()
  }, [geo, path, sizeStrokes])

  const paint = useCallback((intro = false) => {
    const s = d.current
    if (!s.markers || !s.areas) return
    s.radius.domain([0, maxSusp])
    const now = new Map<string, string>()
    s.rows.forEach(r => { r.loc = byCode.get(r.code); if (r.loc) now.set(r.code, `${r.loc.riskScore}|${r.loc.alerts}|${r.loc.suspicious}`) })
    const changed = (r: Row) => !intro && !!r.loc && s.previous.get(r.code) !== now.get(r.code)
    s.previous = now
    s.areas.classed('has-risk', r => !!r.loc).transition('fill').duration(dur(500)).attr('fill', colour).attr('fill-opacity', r => (r.loc ? 0.3 : 0))
    s.markers.attr('fill', colour).attr('stroke', r => (r.loc ? '#E6F6FF' : 'none')).attr('fill-opacity', 0.4)
      .style('filter', r => (r.loc ? `drop-shadow(0 0 ${bandOf(r.loc.riskScore) === 'critical' ? 6 : 3}px ${colour(r)})` : null))
    s.markers.interrupt('size').transition('size').duration(dur(intro ? 800 : 500)).ease(d3.easeCubicOut).delay((_, i) => (intro ? dur(Math.min(i, 120) * 3) : 0)).attr('r', markerR)
    s.areas.filter(changed).interrupt('flash').attr('stroke', '#E6F6FF').attr('stroke-opacity', 1)
      .transition('flash').duration(dur(1600)).ease(d3.easeCubicOut).attr('stroke-opacity', 0.75).attr('stroke', '#16324D')
    setHover(h => (h ? { ...h, row: s.rows.find(r => r.code === h.row.code) ?? h.row } : h))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byCode, maxSusp, markerR])

  const zoomTo = useCallback((bounds: [[number, number], [number, number]], maxK = 16) => {
    const s = d.current, [[x0, y0], [x1, y1]] = bounds
    const k = Math.max(1, Math.min(maxK, 0.85 / Math.max((x1 - x0) / s.w, (y1 - y0) / s.h)))
    d3.select(svgEl.current!).transition().duration(dur(700)).ease(d3.easeCubicInOut)
      .call(s.zoom.transform, d3.zoomIdentity.translate(s.w / 2 - (k * (x0 + x1)) / 2, s.h / 2 - (k * (y0 + y1)) / 2).scale(k))
  }, [])
  const reset = useCallback(() => { d3.select(svgEl.current!).transition().duration(dur(600)).ease(d3.easeCubicInOut).call(d.current.zoom.transform, d3.zoomIdentity) }, [])

  const paintSelection = useCallback(() => {
    d.current.areas?.classed('is-selected', r => r.code === d.current.selected); d.current.markers?.classed('is-selected', r => r.code === d.current.selected)
  }, [])

  const showHover = useCallback((r: Row, ev: PointerEvent) => {
    if (!r.loc || !box.current) return
    const b = box.current.getBoundingClientRect()
    setHover({ row: r, x: ev.clientX - b.left, y: ev.clientY - b.top })
  }, [])

  const select = useCallback((code: string) => {
    const s = d.current, r = s.rows.find(x => x.code === code)
    if (!r) return
    if (s.nation !== 'All' && r.nation !== s.nation) setNation('All')
    s.selected = code; paintSelection(); zoomTo(path.bounds(r.feature), 7)
    setTimeout(() => setHover({ row: r, x: s.w / 2, y: s.h / 2 }), 0)
  }, [paintSelection, path, zoomTo])
  useImperativeHandle(ref, () => ({ select }), [select])

  // Build the SVG once the boundaries are available.
  useEffect(() => {
    if (!geo || !svgEl.current || !box.current) return
    const s = d.current
    s.rows = geo.counties.map(c => ({ ...c }))
    const svg = d3.select(svgEl.current)
    svg.selectAll('*').remove()
    const g = svg.append('g')
    s.nationPaths = g.append('g').selectAll<SVGPathElement, GeoIndex['nations']['features'][number]>('path').data(geo.nations.features).join('path').attr('class', 'uk-nation')
    s.areas = g.append('g').selectAll<SVGPathElement, Row>('path').data(s.rows, r => (r as Row).code).join('path').attr('class', 'uk-area')
      .on('pointerenter pointermove', (ev: PointerEvent, r) => showHover(r, ev)).on('pointerleave', () => setHover(null))
      .on('click', (ev: MouseEvent, r) => { ev.stopPropagation(); if (r.loc) select(r.code) })
    s.markers = g.append('g').selectAll<SVGCircleElement, Row>('circle').data(s.rows, r => (r as Row).code).join('circle').attr('class', 'uk-marker').attr('r', 0)
      .on('pointerenter pointermove', (ev: PointerEvent, r) => showHover(r, ev)).on('pointerleave', () => setHover(null))
      .on('click', (ev: MouseEvent, r) => { ev.stopPropagation(); select(r.code) })
    svg.on('click', () => { s.selected = null; paintSelection() })
    s.zoom.on('zoom', ({ transform }) => { s.k = transform.k; g.attr('transform', transform.toString()); sizeStrokes(); setHover(null) })
    svg.call(s.zoom).on('dblclick.zoom', null)
    layout(); paint(true); s.built = true
    const ro = new ResizeObserver(() => { if (box.current && box.current.clientWidth !== s.w) { layout(); setHover(null) } })
    ro.observe(box.current)
    return () => { ro.disconnect(); svg.on('.zoom', null) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo])

  useEffect(() => { if (d.current.built) paint() }, [paint])

  useEffect(() => {
    const s = d.current
    s.nation = nation
    if (!s.built || !geo) return
    const on = (r: Row) => nation === 'All' || r.nation === nation
    s.markers?.interrupt('filter').transition('filter').duration(dur(400)).style('opacity', r => (on(r) ? 1 : 0.07)).attr('r', markerR)
    s.markers?.style('pointer-events', r => (on(r) ? 'all' : 'none'))
    s.nationPaths?.classed('is-dim', f => nation !== 'All' && PREFIX[f.properties.areacd[0]] !== nation)
    s.areas?.classed('is-dim', r => nation !== 'All' && r.nation !== nation).style('pointer-events', r => (on(r) ? null : 'none'))
    if (nation === 'All') reset()
    else zoomTo(path.bounds({ type: 'FeatureCollection', features: geo.nations.features.filter(f => PREFIX[f.properties.areacd[0]] === nation) }), 8)
  }, [nation, geo, markerR, path, reset, zoomTo])

  const zoomBy = (f: number) => d3.select(svgEl.current!).transition().duration(dur(250)).call(d.current.zoom.scaleBy, f)
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const matches = useMemo(() => {
    const q = norm(query.trim())
    if (!q || !geo) return []
    return geo.counties.filter(c => norm(c.name).includes(q)).sort((a, b) => Number(byCode.has(b.code)) - Number(byCode.has(a.code)) || a.name.localeCompare(b.name)).slice(0, 7)
  }, [query, geo, byCode])
  const choose = (c: CountyArea) => { setQuery(''); setSearchOpen(false); select(c.code) }
  const empty = !!geo && !locations.length
  const legendVals = [...new Set([maxSusp, Math.ceil(maxSusp / 3), 1])].sort((a, b) => b - a)
  const legendR = (v: number) => Math.max(2, d.current.radius(v))
  const tip = hover && box.current ? { left: Math.min(Math.max(8, hover.x + 14), box.current.clientWidth - 212), top: Math.max(8, hover.y - 8) } : null

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <ToggleGroup type="single" variant="outline" size="sm" value={nation} onValueChange={v => v && setNation(v as 'All' | Nation)} aria-label="Filter by nation" className="flex-wrap">
          {NATIONS.map(n => <ToggleGroupItem key={n.id} value={n.id} className="px-2 text-[10.5px]">{n.label}</ToggleGroupItem>)}
        </ToggleGroup>
        <div className="relative w-44">
          <InputGroup className="h-7">
            <InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon>
            <InputGroupInput role="combobox" aria-label="Search counties" aria-expanded={searchOpen && matches.length > 0} aria-controls="county-results" aria-autocomplete="list" placeholder="Search county…" value={query}
              onChange={e => { setQuery(e.target.value); setActive(0) }} onFocus={() => setSearchOpen(true)} onBlur={() => setSearchOpen(false)}
              onKeyDown={e => {
                if (e.key === 'ArrowDown' && matches.length) { setActive(a => (a + 1) % matches.length); e.preventDefault() }
                else if (e.key === 'ArrowUp' && matches.length) { setActive(a => (a - 1 + matches.length) % matches.length); e.preventDefault() }
                else if (e.key === 'Enter' && matches[active]) choose(matches[active])
                else if (e.key === 'Escape') { setQuery(''); setSearchOpen(false) }
              }} />
          </InputGroup>
          {searchOpen && query.trim() && (
            <ul id="county-results" role="listbox" aria-label="Matching counties" className="absolute top-8 right-0 z-20 w-56 rounded-lg border bg-popover p-1 shadow-xl">
              {!matches.length && <li className="px-2 py-2 text-[11px] text-subtle" role="option" aria-disabled="true" aria-selected="false">No county matches</li>}
              {matches.map((c, i) => { const l = byCode.get(c.code); return (
                <li key={c.code} role="option" aria-selected={i === active} className={cn('flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[11px]', i === active && 'bg-muted')} onPointerDown={e => { e.preventDefault(); choose(c) }}>
                  <span className="truncate">{c.name}</span><span className={cn('shrink-0 text-[10px]', l ? 'text-hl' : 'text-subtle')}>{l ? `${l.riskScore} · ${BAND_META[bandOf(l.riskScore)!].label}` : 'below 60'}</span>
                </li>) })}
            </ul>
          )}
        </div>
      </div>

      <div ref={box} className="relative min-h-[320px] flex-1 overflow-hidden rounded-lg border bg-[radial-gradient(ellipse_at_50%_40%,#0C2036,#06111F)]">
        <svg ref={svgEl} className="absolute inset-0 size-full touch-none" role="img" aria-label="Map of UK counties shaded by fraud risk for alerts scoring 60 and above, with markers sized by suspicious transactions. Use the county search or the Top Risk Locations list for keyboard access." />
        {!geo && !error && <div className="absolute inset-3 animate-pulse rounded-md bg-white/5" role="status" aria-label="Loading UK boundaries" />}
        {error && <div className="absolute inset-0 grid place-items-center p-6 text-center text-xs text-sev-crit" role="alert">{error}</div>}
        {empty && (
          <div className="pointer-events-none absolute inset-x-6 top-1/2 -translate-y-1/2 rounded-lg border bg-card/90 p-3 text-center text-[11px] text-muted-foreground" role="status">
            <p className="font-medium text-foreground">No counties at risk score {RISK_THRESHOLD}+</p>
            <p className="mt-1 text-subtle">{unlocated ? `${unlocated} high-risk alert${unlocated === 1 ? ' has' : 's have'} no location: set la_code on the account.` : 'No active high-risk alerts have a location right now.'}</p>
          </div>
        )}
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          <Button variant="outline" size="icon-sm" aria-label="Zoom in" onClick={() => zoomBy(1.6)}><Plus /></Button>
          <Button variant="outline" size="icon-sm" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.6)}><Minus /></Button>
          <Button variant="outline" size="icon-sm" aria-label="Reset map view" onClick={() => { setNation('All'); d.current.selected = null; paintSelection(); reset() }}><Maximize2 /></Button>
        </div>
        <div className="pointer-events-none absolute bottom-2 left-2 rounded-md border bg-card/90 px-2.5 py-2 text-[10px] text-muted-foreground">
          <p className="mb-1 font-medium text-foreground">Risk score {RISK_THRESHOLD}+ only</p>
          <ul className="space-y-0.5">{Object.entries(BAND_META).map(([id, b]) => <li key={id} className="flex items-center gap-1.5"><span className="size-2 rounded-sm" style={{ background: b.color }} aria-hidden="true" /><span className="tnum">{b.range}</span><span className="text-subtle">{b.label}</span></li>)}</ul>
          <div className="mt-1.5 flex items-end gap-1.5 border-t pt-1.5" aria-hidden="true">{legendVals.map(v => <svg key={v} width={legendR(v) * 2 + 2} height={legendR(v) * 2 + 2}><circle cx={legendR(v) + 1} cy={legendR(v) + 1} r={legendR(v)} fill="#8DD4FA" fillOpacity=".35" stroke="#E6F6FF" /></svg>)}</div>
          <p className="mt-0.5">Suspicious transactions <span className="tnum text-foreground">{legendVals.join(' · ')}</span></p>
        </div>
        {unlocated > 0 && !empty && <p className="pointer-events-none absolute right-2 bottom-2 rounded-md border bg-card/90 px-2 py-1 text-[10px] text-subtle">{unlocated} high-risk alert{unlocated === 1 ? '' : 's'} without a location</p>}
        {hover && tip && (
          <div className="pointer-events-none absolute z-10 w-52 rounded-lg border bg-popover/95 p-2.5 text-[11px] shadow-2xl backdrop-blur" style={tip} role="status">
            <p className="text-[9.5px] tracking-wide text-subtle uppercase">{hover.row.nation}</p>
            <p className="mt-0.5 text-[13px] font-semibold">{hover.row.name}</p>
            {hover.row.loc ? (
              <dl className="mt-2 space-y-1 text-muted-foreground">
                <div className="flex justify-between"><dt>Risk score</dt><dd className="tnum" style={{ color: BAND_META[bandOf(hover.row.loc.riskScore)!].color }}>{hover.row.loc.riskScore} · {BAND_META[bandOf(hover.row.loc.riskScore)!].label}</dd></div>
                <div className="flex justify-between"><dt>Suspicious transactions</dt><dd className="tnum text-foreground">{hover.row.loc.suspicious.toLocaleString('en-GB')}</dd></div>
                <div className="flex justify-between"><dt>Alerts</dt><dd className="tnum text-foreground">{hover.row.loc.alerts.toLocaleString('en-GB')}</dd></div>
                <div className="flex justify-between gap-2"><dt>Last updated</dt><dd className="tech text-right text-[10.5px] text-foreground">{when(hover.row.loc.lastUpdated)}</dd></div>
              </dl>
            ) : <p className="mt-2 text-subtle">No active alerts at {RISK_THRESHOLD}+ in this county.</p>}
          </div>
        )}
      </div>
    </div>
  )
})
