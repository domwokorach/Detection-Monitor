import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Loader2, MapPinOff, RotateCw } from 'lucide-react'
import MapGL, { AttributionControl, type MapLayerMouseEvent, type MapRef } from 'react-map-gl/maplibre'
import type { GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { GeoIndex } from '@/lib/countyRisk'
import { CountyDetailsPanel } from './CountyDetailsPanel'
import { CountyRiskLayer } from './CountyRiskLayer'
import { LiveMapStatus } from './LiveMapStatus'
import { MapFilterToolbar } from './MapFilterToolbar'
import { MapZoomControls } from './MapZoomControls'
import { MARKER_LAYERS, RiskMarkerLayer } from './RiskMarkerLayer'
import { RiskTooltip, type Hover } from './RiskTooltip'
import { areaCollection, countyCollection, featureBounds, ukMask, type Aggregate, type Filters } from './model'
import { BOUNDARY_ATTRIBUTION, basemapStyle, MAX_ZOOM, MIN_ZOOM, UK_BOUNDS, UK_MAX_BOUNDS } from './style'
import type { Feed } from './use-risk-map-data'

export type UKRiskMapHandle = { select: (countyCode: string) => void }
type Props = { geo?: GeoIndex; geoError?: string; feed: Feed; agg: Aggregate; filters: Filters; onFilters: (f: Filters) => void }

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const ms = (n: number) => (reduced() ? 0 : n)
const PLACE_LAYERS = ['place-city', 'place-town']
const NOTE_AREA = 'Area-level position from the account’s local authority, not a street or IP-derived location.'

const banner = 'flex items-center gap-2 rounded-[5px] border border-[#1B344D] bg-[#0B1E33]/95 px-3 py-2 text-xs text-[#F2F7FC] shadow-lg backdrop-blur'

export const UKRiskMap = forwardRef<UKRiskMapHandle, Props>(function UKRiskMap({ geo, geoError, feed, agg, filters, onFilters }, ref) {
  const mapRef = useRef<MapRef>(null)
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 500 })
  const [ready, setReady] = useState(false)
  const [tileError, setTileError] = useState(false)
  const [zoom, setZoom] = useState(5)
  const [selected, setSelected] = useState<string | null>(null)
  const [selectedArea, setSelectedArea] = useState<string | null>(null)
  const [hover, setHover] = useState<Hover | null>(null)
  const [hoverCounty, setHoverCounty] = useState<string | null>(null)
  const [cursor, setCursor] = useState('')
  const touched = useRef(false) // analyst has moved the map: never auto-move it again
  const focused = useRef(false)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const countyLayer = useMemo(() => (geo ? countyCollection(geo, agg) : null), [geo, agg])
  const areas = useMemo(() => areaCollection(agg), [agg])
  const mask = useMemo(() => (geo ? ukMask(geo) : null), [geo])
  const wide = size.w >= 820

  const fitCounty = useCallback((code: string, maxZoom = 11) => {
    const county = geo?.counties.find(c => c.code === code)
    if (!county) return
    mapRef.current?.fitBounds(featureBounds(county.feature), { padding: { top: 80, bottom: 60, right: 70, left: wide ? 350 : 40 }, maxZoom, duration: ms(1100), essential: false })
  }, [geo, wide])

  const flyTo = useCallback((lonlat: [number, number], minZoom: number, panelOpen = false) => {
    const map = mapRef.current
    if (map) map.flyTo({ center: lonlat, zoom: Math.max(map.getZoom(), minZoom), offset: [wide && panelOpen ? 170 : 0, 0], duration: ms(1100), essential: false })
  }, [wide])

  const reset = useCallback(() => {
    setSelected(null); setSelectedArea(null)
    mapRef.current?.fitBounds(UK_BOUNDS, { padding: { top: 70, bottom: 40, left: wide ? 350 : 20, right: 60 }, duration: ms(1000) })
  }, [wide])

  const pickCounty = useCallback((code: string) => { touched.current = true; setSelected(code); setSelectedArea(null); fitCounty(code) }, [fitCounty])
  useImperativeHandle(ref, () => ({ select: pickCounty }), [pickCounty])

  const pickArea = useCallback((code: string) => {
    const a = agg.areas.find(x => x.code === code)
    if (!a) return
    touched.current = true
    setSelectedArea(code); setSelected(a.countyCode ?? selected)
    flyTo(a.lonlat, 11.5, true)
  }, [agg.areas, flyTo, selected])

  // First genuine data focuses the highest-risk county once, and only while the analyst has not touched the map.
  useEffect(() => {
    if (!ready || !geo || focused.current || feed.status === 'loading') return
    focused.current = true
    if (touched.current || !agg.counties.length) return
    fitCounty(agg.counties[0].code, 9)
  }, [ready, geo, feed.status, agg.counties, fitCounty])

  const onClick = useCallback(async (e: MapLayerMouseEvent) => {
    const f = e.features?.[0]
    const map = mapRef.current
    if (!f || !map) { return }
    touched.current = true
    const p = f.properties ?? {}
    if (f.layer.id === 'risk-clusters') {
      const src = map.getSource('risk-areas') as GeoJSONSource
      const z = await src.getClusterExpansionZoom(p.cluster_id)
      map.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom: Math.min(z + 0.3, 14), duration: ms(700) })
    } else if (f.layer.id === 'risk-points') pickArea(p.code)
    else if (PLACE_LAYERS.includes(f.layer.id)) flyTo((f.geometry as GeoJSON.Point).coordinates as [number, number], f.layer.id === 'place-city' ? 12.5 : 12)
    else if (f.layer.id === 'county-fill') pickCounty(p.code)
  }, [pickArea, pickCounty, flyTo])

  const onMove = useCallback((e: MapLayerMouseEvent) => {
    const f = e.features?.[0]
    setCursor(f ? 'pointer' : '')
    setHoverCounty(e.features?.find(x => x.layer.id === 'county-fill')?.properties?.code ?? null)
    const p = f?.properties ?? {}
    if (!f || PLACE_LAYERS.includes(f.layer.id)) setHover(null)
    else if (f.layer.id === 'risk-clusters') setHover({ x: e.point.x, y: e.point.y, title: `${p.count} alerts`, subtitle: `${p.point_count} local authorities`, alerts: p.count, maxScore: p.maxScore, note: 'Click to expand' })
    else if (f.layer.id === 'risk-points') setHover({ x: e.point.x, y: e.point.y, title: p.name, subtitle: 'Local authority', alerts: p.alerts, maxScore: p.maxScore, note: NOTE_AREA })
    else setHover({ x: e.point.x, y: e.point.y, title: p.name, subtitle: p.alerts ? undefined : 'No alerts at 60+', alerts: p.alerts, maxScore: p.maxScore })
  }, [])

  const countyShape = selected ? geo?.counties.find(c => c.code === selected) : undefined
  const interactive = ready && geo ? [...MARKER_LAYERS, 'county-fill', ...PLACE_LAYERS] : undefined
  const nothing = feed.status === 'live' && agg.totals.alerts === 0
  const busy = !ready || (feed.status === 'loading' && !feed.data)

  return (
    <div ref={box} className="relative size-full overflow-hidden rounded-[5px] border border-[#1B344D] bg-[#071426]" role="region" aria-label="UK fraud risk map">
      <MapGL ref={mapRef} mapStyle={basemapStyle} style={{ width: '100%', height: '100%' }} cursor={cursor}
        initialViewState={{ bounds: UK_BOUNDS, fitBoundsOptions: { padding: { top: 70, bottom: 40, left: 20, right: 60 } } }}
        minZoom={MIN_ZOOM} maxZoom={MAX_ZOOM} maxBounds={UK_MAX_BOUNDS} attributionControl={false} dragRotate={false} touchPitch={false}
        interactiveLayerIds={interactive} onLoad={() => setReady(true)} onIdle={() => setTileError(false)} onError={e => { console.error('[risk-map]', e.error?.message ?? e); setTileError(true) }}
        onMoveStart={e => { if (e.originalEvent) touched.current = true }} onMove={e => setZoom(Math.round(e.viewState.zoom * 10) / 10)}
        onClick={onClick} onMouseMove={onMove} onMouseLeave={() => { setHover(null); setHoverCounty(null); setCursor('') }}>
        {geo && countyLayer && mask && <CountyRiskLayer counties={countyLayer} localAuthorities={geo.localAuthorities} nations={geo.nations} mask={mask} selected={selected} hover={hoverCounty} />}
        {geo && <RiskMarkerLayer areas={areas} selectedArea={selectedArea} />}
        <AttributionControl position="bottom-right" compact={false} customAttribution={BOUNDARY_ATTRIBUTION} />
      </MapGL>

      <div className="pointer-events-none absolute inset-3 flex flex-col gap-2 sm:right-14">
        <div className="pointer-events-auto self-start"><MapFilterToolbar filters={filters} onChange={onFilters} /></div>
        {countyShape && <div className="pointer-events-auto flex min-h-0 flex-1 items-start"><CountyDetailsPanel county={countyShape} agg={agg.byCounty.get(countyShape.code)} onClose={() => { setSelected(null); setSelectedArea(null) }} onArea={pickArea} /></div>}
      </div>
      <div className="absolute right-3 top-3"><MapZoomControls onZoomIn={() => mapRef.current?.zoomIn({ duration: ms(300) })} onZoomOut={() => mapRef.current?.zoomOut({ duration: ms(300) })} onReset={reset} canZoomIn={zoom < MAX_ZOOM - 0.1} canZoomOut={zoom > MIN_ZOOM + 0.1} /></div>
      <div className={`absolute bottom-8 right-3 ${selected ? 'max-sm:hidden' : ''}`}><LiveMapStatus feed={feed} totals={agg.totals} unlocated={(feed.data?.unlocated ?? 0) + agg.unplaced} threshold={feed.data?.threshold ?? 60} /></div>

      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-col items-start gap-2 sm:items-center">
        {feed.status === 'error' && <div role="alert" className={`${banner} pointer-events-auto`}><AlertTriangle className="size-4 text-[#E85D68]" aria-hidden="true" />{feed.data ? 'Live updates paused: ' : 'Risk data unavailable: '}{feed.error}<button onClick={feed.reload} className="ml-1 flex items-center gap-1 rounded-[5px] border border-[#1B344D] px-2 py-0.5 hover:bg-[#12304A]"><RotateCw className="size-3" aria-hidden="true" />Retry</button></div>}
        {geoError && <div role="alert" className={banner}><MapPinOff className="size-4 text-amber-400" aria-hidden="true" />Boundary data could not be loaded, so county risk and markers are hidden. {geoError}</div>}
        {tileError && <div role="alert" className={banner}><AlertTriangle className="size-4 text-amber-400" aria-hidden="true" />Some basemap tiles failed to load. Check your connection.</div>}
        {nothing && !geoError && <div className={banner}>No active alerts scoring {feed.data?.threshold ?? 60}+ match the current filters. Showing the UK overview.</div>}
      </div>
      {busy && !geoError && <div className="absolute inset-0 grid place-items-center bg-[#071426]/70 text-xs text-[#8CA2BA]" role="status"><span className="flex items-center gap-2"><Loader2 className="size-4 animate-spin text-[#65B9EE]" aria-hidden="true" />Loading map…</span></div>}
      <RiskTooltip hover={hover} width={size.w} height={size.h} />
    </div>
  )
})
