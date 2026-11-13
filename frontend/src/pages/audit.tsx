import { useMemo, useState } from 'react'
import { FilterX, ScrollText, Search } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { AuditTimeline } from '@/components/app/audit-timeline'
import { DateRangePicker } from '@/components/app/date-range-picker'
import { EmptyState, ErrorState, PageHeader } from '@/components/app/common'
import { refresh, useApp } from '@/store/app'
import { titleCase } from '@/lib/format'

const PAGE = 30
export default function Audit() {
  const { audit, loaded, error } = useApp()
  const [f, setF] = useState({ q: '', actor: 'all', action: 'all', entity: 'all' })
  const [range, setRange] = useState<DateRange | undefined>()
  const [limit, setLimit] = useState(PAGE)
  const uniq = (k: 'actor' | 'action' | 'entity_type') => [...new Set(audit.map(e => e[k]))].sort()
  const filtered = useMemo(() => {
    const q = f.q.trim().toLowerCase()
    const from = range?.from ? new Date(range.from).setHours(0, 0, 0, 0) : -Infinity
    const to = range?.to ? new Date(range.to).setHours(23, 59, 59, 999) : range?.from ? new Date(range.from).setHours(23, 59, 59, 999) : Infinity
    return audit.filter(e => { const t = +new Date(e.created_at)
      return t >= from && t <= to && (f.actor === 'all' || e.actor === f.actor) && (f.action === 'all' || e.action === f.action) && (f.entity === 'all' || e.entity_type === f.entity)
        && (!q || `${e.actor} ${e.action} ${e.entity_type} ${e.entity_id} ${JSON.stringify(e.after ?? {})}`.toLowerCase().includes(q)) })
  }, [audit, f, range])
  const active = !!range || Object.entries(f).some(([k, v]) => (k === 'q' ? v !== '' : v !== 'all'))
  const upd = (patch: Partial<typeof f>) => { setF({ ...f, ...patch }); setLimit(PAGE) }
  const loading = !loaded && !error
  return (
    <div>
      <PageHeader title="Audit History" description={`${filtered.length.toLocaleString()} events · tamper-evident hash chain`}
        actions={<><DateRangePicker value={range} onChange={r => { setRange(r); setLimit(PAGE) }} presets={[1, 7, 14]} /><Button size="sm" variant="ghost" disabled={!active} onClick={() => { setF({ q: '', actor: 'all', action: 'all', entity: 'all' }); setRange(undefined) }}><FilterX data-icon="inline-start" />Clear</Button></>} />
      {error && !loaded && <ErrorState message={error} onRetry={() => refresh()} />}
      <Card className="dash-card gap-4 p-3.5">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <InputGroup className="h-8 sm:col-span-2 lg:col-span-4"><InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon><InputGroupInput aria-label="Search audit events" placeholder="Search actor, event, entity ID or content…" value={f.q} onChange={e => upd({ q: e.target.value })} /></InputGroup>
          <NativeSelect aria-label="Filter by analyst" value={f.actor} onChange={e => upd({ actor: e.target.value })}><NativeSelectOption value="all">All analysts</NativeSelectOption>{uniq('actor').map(v => <NativeSelectOption key={v} value={v}>{v}</NativeSelectOption>)}</NativeSelect>
          <NativeSelect aria-label="Filter by event type" value={f.action} onChange={e => upd({ action: e.target.value })}><NativeSelectOption value="all">All event types</NativeSelectOption>{uniq('action').map(v => <NativeSelectOption key={v} value={v}>{titleCase(v)}</NativeSelectOption>)}</NativeSelect>
          <NativeSelect aria-label="Filter by entity" value={f.entity} onChange={e => upd({ entity: e.target.value })}><NativeSelectOption value="all">All entities</NativeSelectOption>{uniq('entity_type').map(v => <NativeSelectOption key={v} value={v}>{titleCase(v)}</NativeSelectOption>)}</NativeSelect>
        </div>
        {loading ? <div className="space-y-3" aria-busy="true">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>
          : !filtered.length ? <EmptyState icon={ScrollText} title={audit.length ? 'No events match these filters' : 'No audit events yet'} body={audit.length ? 'Adjust or clear the filters.' : 'Events appear as analysts and the system act.'} />
          : <><AuditTimeline events={filtered.slice(0, limit)} />{filtered.length > limit && <div className="text-center"><Button size="sm" variant="outline" onClick={() => setLimit(l => l + PAGE)}>Show more ({filtered.length - limit} remaining)</Button></div>}</>}
      </Card>
    </div>
  )
}
