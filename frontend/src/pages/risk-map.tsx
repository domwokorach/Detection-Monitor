import { useEffect, useMemo, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { PageHeader, RiskBadge } from '@/components/app/common'
import { UKRiskMap, type UKRiskMapHandle, useRiskMapData, aggregate, EMPTY_AGG, DEFAULT_FILTERS, type Filters } from '@/components/risk-map'
import { useApp } from '@/store/app'
import { loadGeo, RISK_THRESHOLD, type GeoIndex } from '@/lib/countyRisk'
import { relative } from '@/lib/format'

export default function RiskMapPage() {
  const { demo } = useApp()
  const [geo, setGeo] = useState<GeoIndex>()
  const [geoError, setGeoError] = useState('')
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const ref = useRef<UKRiskMapHandle>(null)
  const feed = useRiskMapData()
  useEffect(() => { loadGeo().then(setGeo).catch(e => setGeoError(e instanceof Error ? e.message : 'Boundary file missing')) }, [])
  const agg = useMemo(() => (geo && feed.data ? aggregate(geo, feed.data.events, filters) : EMPTY_AGG), [geo, feed.data, filters])
  const ranked = agg.counties
  return (
    <div>
      <PageHeader title="UK Risk Map" description="Live county-level fraud risk on a real UK map, for alerts scoring 60 and above"
        actions={<><Badge className="bg-primary/15 text-hl" title="High Risk Counties Only">Risk Threshold: {RISK_THRESHOLD}+</Badge>{demo && <Badge variant="outline" className="border-sev-med/40 text-sev-med">Demo data</Badge>}</>} />
      <div className="grid gap-3 xl:grid-cols-[1fr_20rem]">
        <Card className="dash-card py-3"><CardContent className="h-[calc(100vh-11rem)] min-h-[480px] px-3"><UKRiskMap ref={ref} geo={geo} geoError={geoError} feed={feed} agg={agg} filters={filters} onFilters={setFilters} /></CardContent></Card>
        <Card className="dash-card gap-2 py-3">
          <CardHeader className="px-3.5"><CardTitle className="text-[13px]">High-risk counties</CardTitle><CardDescription className="text-[11px]">{ranked.length} at {RISK_THRESHOLD}+ · select to focus</CardDescription></CardHeader>
          <CardContent className="px-1.5"><ScrollArea className="h-[calc(100vh-17rem)] min-h-[260px]">
            {!ranked.length && <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-xs text-muted-foreground"><MapPin className="size-5 text-primary" aria-hidden="true" />No counties at {RISK_THRESHOLD}+ right now.</div>}
            <ul className="space-y-0.5 px-1">{ranked.map(l => (
              <li key={l.code}><button className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring" onClick={() => ref.current?.select(l.code)}>
                <span className="min-w-0"><span className="block truncate text-xs font-medium">{l.name}</span><span className="block text-[10px] text-subtle">{l.alerts} alert{l.alerts === 1 ? '' : 's'} · {l.transactions} high-risk tx · {relative(l.lastUpdated)}</span></span><RiskBadge score={l.maxScore} />
              </button></li>))}</ul>
          </ScrollArea></CardContent>
        </Card>
      </div>
    </div>
  )
}
