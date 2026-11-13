import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { Globe2, MapPinOff, Maximize2, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BAND_META, bandOf, loadGeo, RISK_THRESHOLD, type GeoIndex } from '@/lib/countyRisk'
import { money } from '@/lib/format'
import { londonTime, londonZone } from '@/lib/time'
import type { GeoPoint, IpIntel } from '@/types'
import { Skeleton } from '@/components/ui/skeleton'
import { Section } from './shared'

type Tip = { x: number; y: number; title: string; lines: [string, string][] }
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const colourOf = (score: number) => BAND_META[bandOf(score) ?? 'medium-high'].color

/**
 * D3 map of the UK for the IP-estimated location and related suspicious transactions (risk >= 60).
 * IP geolocation is an estimate, so it is drawn with an uncertainty circle; a location outside the UK
 * is labelled as external and never plotted on the UK map.
 */
export function GeoCard({ ip, points }: { ip: IpIntel | null; points: GeoPoint[] }) {
  const box = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown>>(d3.zoom<SVGSVGElement, unknown>().scaleExtent([1, 14]))
  const [geo, setGeo] = useState<GeoIndex>()
  const [error, setError] = useState('')
  const [width, setWidth] = useState(0)
  const [tip, setTip] = useState<Tip | null>(null)

  useEffect(() => { loadGeo().then(setGeo).catch(e => setError(e instanceof Error ? e.message : 'Could not load UK boundaries')) }, [])
  useEffect(() => {
    if (!box.current) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)))
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [])

  const g = ip?.geo
  const hasCoords = !!g && g.lat != null && g.lon != null
  const inUk = (country: string | null, lon: number, lat: number) =>
    country ? country === 'GB' : !!geo && geo.nations.features.some(f => d3.geoContains(f, [lon, lat]))
  const external = hasCoords && !!geo && !inUk(g!.country, g!.lon!, g!.lat!)
  const suspicious = useMemo(() => points.filter(p => p.risk_score >= RISK_THRESHOLD), [points])
  const ukPoints = useMemo(() => suspicious.filter(p => !!geo && inUk(p.country, p.lon, p.lat)), [suspicious, geo]) // eslint-disable-line react-hooks/exhaustive-deps
  const outside = suspicious.length - ukPoints.length
  const countyCode = g?.la_code && geo ? geo.resolve(g.la_code) : null
  const county = geo?.counties.find(c => c.code === countyCode)

  useEffect(() => {
    if (!geo || !svgRef.current || width < 80) return
    const h = Math.round(Math.min(440, Math.max(300, width * 1.05)))
    const svg = d3.select(svgRef.current).attr('viewBox', `0 0 ${width} ${h}`).attr('height', h)
    svg.selectAll('*').remove()
    const proj = d3.geoMercator().fitExtent([[10, 8], [width - 10, h - 8]], geo.nations)
    const path = d3.geoPath(proj)
    const root = svg.append('g')
    const dur = reduced() ? 0 : 500
    const hasPoint = hasCoords && !external
    const k0 = hasPoint ? 4 : 1
    let initial = d3.zoomIdentity

    root.append('g').selectAll('path').data(geo.nations.features).join('path').attr('d', path).attr('fill', '#0B1E33').attr('stroke', '#1B344D').attr('stroke-linejoin', 'round')
    if (county) root.append('path').datum(county.feature).attr('d', path).attr('fill', '#65B9EE').attr('fill-opacity', 0.22).attr('stroke', '#8DD4FA').attr('stroke-opacity', 0.8)

    const place = (lon: number, lat: number) => proj([lon, lat])!
    const show = (ev: PointerEvent, t: Omit<Tip, 'x' | 'y'>) => {
      const b = box.current!.getBoundingClientRect()
      setTip({ ...t, x: ev.clientX - b.left, y: ev.clientY - b.top })
    }
    const marks = root.append('g')
    // Related suspicious transactions (>= 60), excluding the current one which is drawn on top.
    marks.selectAll('circle').data(ukPoints.filter(p => !p.current)).join('circle').attr('class', 'geo-mark').attr('tabindex', null)
      .attr('cx', p => place(p.lon, p.lat)[0]).attr('cy', p => place(p.lon, p.lat)[1]).attr('fill', p => colourOf(p.risk_score)).attr('fill-opacity', 0.55).attr('stroke', '#E6F6FF').attr('stroke-opacity', 0.7)
      .attr('r', 0).on('pointerenter pointermove', (ev: PointerEvent, p) => show(ev, { title: p.counterparty, lines: [['Risk score', `${p.risk_score}`], ['Amount', money(p.amount, p.currency)], ['Estimated', [p.city, p.country].filter(Boolean).join(', ') || 'Unknown'], ['When', `${londonTime(p.occurred_at)} ${londonZone(p.occurred_at)}`]] }))
      .on('pointerleave', () => setTip(null)).transition().duration(dur).attr('r', 5 / Math.sqrt(k0))

    if (hasCoords && !external) {
      const [cx, cy] = place(g!.lon!, g!.lat!)
      const lonPerKm = 1 / (111.32 * Math.cos((g!.lat! * Math.PI) / 180))
      const pxPerKm = Math.abs(place(g!.lon! + lonPerKm, g!.lat!)[0] - cx)
      const km = g!.accuracy_km ?? null
      const unc = root.append('g')
      if (km != null) unc.append('circle').attr('class', 'geo-uncertainty').attr('cx', cx).attr('cy', cy).attr('r', Math.max(7, km * pxPerKm)).attr('fill', '#65B9EE').attr('fill-opacity', 0.14).attr('stroke', '#8DD4FA').attr('stroke-opacity', 0.55).attr('stroke-dasharray', '3 3')
      unc.append('circle').attr('class', 'geo-current').attr('cx', cx).attr('cy', cy).attr('r', 0).attr('fill', '#BFE8FF').attr('stroke', '#65B9EE').style('filter', 'drop-shadow(0 0 6px #65B9EE)')
        .on('pointerenter pointermove', (ev: PointerEvent) => show(ev, { title: 'IP-estimated location', lines: [['Place', [g!.city, g!.county, g!.region].filter(Boolean).join(', ') || 'Unknown'], ['Accuracy', km != null ? `±${km} km` : 'Not provided'], ['Source', g!.provider ?? 'Not provided']] }))
        .on('pointerleave', () => setTip(null)).transition().duration(dur).attr('r', 6.5 / Math.sqrt(k0))
      // Start framed on the estimate so a ~10 km circle is actually visible.
      initial = d3.zoomIdentity.translate(width / 2 - k0 * cx, h / 2 - k0 * cy).scale(k0)
    }
    zoomRef.current.extent([[0, 0], [width, h]]).translateExtent([[-width * 0.2, -h * 0.2], [width * 1.2, h * 1.2]])
      .on('zoom', ({ transform }) => {
        root.attr('transform', transform.toString()); setTip(null)
        const k = transform.k
        root.selectAll('path').attr('stroke-width', 0.8 / k)
        marks.selectAll('circle').attr('r', 5 / Math.sqrt(k)).attr('stroke-width', 1 / k)
        root.selectAll('.geo-uncertainty').attr('stroke-width', 1 / k)
        root.selectAll('.geo-current').attr('r', 6.5 / Math.sqrt(k)).attr('stroke-width', 1.5 / k)
      })
    svg.call(zoomRef.current).on('dblclick.zoom', null)
    svg.call(zoomRef.current.transform, initial)
    return () => { svg.on('.zoom', null) }
  }, [geo, width, ukPoints, county, hasCoords, external, g]) // eslint-disable-line react-hooks/exhaustive-deps

  const zoomBy = (f: number) => d3.select(svgRef.current!).transition().duration(reduced() ? 0 : 250).call(zoomRef.current.scaleBy, f)
  const reset = () => d3.select(svgRef.current!).transition().duration(reduced() ? 0 : 400).call(zoomRef.current.transform, d3.zoomIdentity)
  const tipPos = tip && box.current ? { left: Math.min(Math.max(8, tip.x + 14), Math.max(8, box.current.clientWidth - 220)), top: Math.max(8, tip.y - 8) } : null
  const summary = !hasCoords ? 'No IP-based location available.' : external ? `IP estimated outside the UK in ${g!.city ?? ''} ${g!.country ?? ''}.` : `IP estimated near ${g!.city ?? 'an unnamed place'}, ${g!.country ?? 'UK'}.`

  return (
    <Section title="Geographic Activity" subtitle={`Estimated IP location and related suspicious transactions (risk ${RISK_THRESHOLD}+)`}>
      <div ref={box} className="relative overflow-hidden rounded-lg border bg-[radial-gradient(ellipse_at_50%_40%,#0C2036,#06111F)]">
        {!geo && !error && <Skeleton className="h-[320px] rounded-none" role="status" aria-label="Loading UK boundaries" />}
        {error && <div role="alert" className="grid h-[320px] place-items-center p-6 text-center text-xs text-sev-crit">{error}</div>}
        <svg ref={svgRef} className="block w-full touch-none" role="img" aria-label={`UK map. ${summary} ${ukPoints.length} related suspicious transaction${ukPoints.length === 1 ? '' : 's'} plotted.`} />
        {geo && (
          <div className="absolute top-2 right-2 flex flex-col gap-1">
            <Button variant="outline" size="icon-sm" aria-label="Zoom in" onClick={() => zoomBy(1.7)}><Plus /></Button>
            <Button variant="outline" size="icon-sm" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.7)}><Minus /></Button>
            <Button variant="outline" size="icon-sm" aria-label="Reset map view" onClick={reset}><Maximize2 /></Button>
          </div>)}
        {geo && !hasCoords && (
          <div role="status" className="pointer-events-none absolute inset-x-6 top-1/2 flex -translate-y-1/2 flex-col items-center gap-1.5 rounded-lg border bg-card/90 p-3 text-center">
            <MapPinOff className="size-4 text-subtle" aria-hidden="true" /><p className="text-xs font-medium">No IP location to plot</p>
            <p className="text-[11px] text-subtle">{ip ? 'The provider returned no coordinates for this IP.' : 'No source IP was captured for this transaction.'}</p>
          </div>)}
        {external && (
          <div role="status" className="absolute inset-x-3 bottom-3 flex items-start gap-2.5 rounded-lg border border-sev-med/40 bg-card/95 p-3">
            <Globe2 className="mt-0.5 size-4 shrink-0 text-sev-med" aria-hidden="true" />
            <div><p className="text-xs font-semibold">External location — outside the UK</p><p className="mt-0.5 text-[11px] text-muted-foreground">IP estimated in {[g!.city, g!.region, g!.country].filter(Boolean).join(', ')}{g!.accuracy_km != null && ` (±${g!.accuracy_km} km)`}. It is not drawn on the UK map.</p></div>
          </div>)}
        <div className="pointer-events-none absolute bottom-2 left-2 rounded-md border bg-card/90 px-2 py-1.5 text-[10px] text-muted-foreground" style={external ? { display: 'none' } : undefined}>
          <p className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full border border-primary bg-ice" aria-hidden="true" />IP estimate</p>
          <p className="mt-0.5 flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full border border-dashed border-hl bg-primary/20" aria-hidden="true" />Uncertainty radius</p>
          <p className="mt-0.5 flex items-center gap-1.5"><span className="inline-block size-2 rounded-full bg-hl/60" aria-hidden="true" />Suspicious ({RISK_THRESHOLD}+)</p>
        </div>
        {tip && tipPos && (
          <div role="status" className="pointer-events-none absolute z-10 w-52 rounded-lg border bg-popover/95 p-2.5 text-[11px] shadow-2xl backdrop-blur" style={tipPos}>
            <p className="text-[12.5px] font-semibold text-ice">{tip.title}</p>
            <dl className="mt-1.5 space-y-1 text-muted-foreground">{tip.lines.map(([k, v]) => <div key={k} className="flex justify-between gap-2"><dt>{k}</dt><dd className="text-right text-foreground">{v}</dd></div>)}</dl>
          </div>)}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
        {([['Local authority / county', county?.name ?? g?.county ?? null], ['Region', g?.region ?? null], ['Country', g?.country ?? null], ['Related suspicious', `${suspicious.length}`]] as [string, string | null][]).map(([k, v]) => (
          <div key={k}><dt className="text-[10.5px] text-subtle">{k}</dt><dd className={v ? 'mt-0.5' : 'mt-0.5 text-subtle italic'}>{v ?? 'Not provided'}</dd></div>))}
      </dl>
      {outside > 0 && <p className="mt-2 text-[11px] text-subtle">{outside} related suspicious transaction{outside === 1 ? ' is' : 's are'} located outside the UK and not shown on the map.</p>}
      <p className="mt-2 text-[10.5px] text-subtle">{g?.provider ? `Estimate from ${g.provider}${g.confidence ? ` · ${g.confidence} confidence` : ''}. ` : ''}IP geolocation approximates a network's location; it does not identify the person's address.</p>
    </Section>
  )
}
