import { useCallback, useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useIsFetching, useQuery } from '@tanstack/react-query'
import type { DateRange } from 'react-day-picker'
import { ChevronLeft, ChevronRight, FlaskConical, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { EmptyState, PageHeader } from '@/components/app/common'
import { DateRangePicker } from '@/components/app/date-range-picker'
import { ExportMenu } from '@/components/investigations/export-menu'
import { InvestigationKpis } from '@/components/investigations/kpis'
import { LiveStatus } from '@/components/investigations/live-status'
import { RegisterTable } from '@/components/investigations/register-table'
import { Workspace } from '@/components/investigations/workspace'
import { POLL_MS, useInvestigationsLive } from '@/hooks/use-investigations-live'
import { dayKey } from '@/lib/dashboard'
import { fetchRegister, fetchSummary, NO_FILTERS, type Filters } from '@/services/investigations'
import { set, useApp, useMerchantLookup } from '@/store/app'
import { SearchCheck } from 'lucide-react'

const SIZES = [25, 50, 100]
const STATUS_OPTS: [string, string][] = [['all', 'All statuses'], ['active', 'Active'], ['OPEN', 'Open'], ['IN_REVIEW', 'In review'], ['ESCALATED', 'Escalated'], ['CLOSED', 'Closed']]
const SEV_OPTS: [string, string][] = [['', 'All severities'], ['critical', 'Critical'], ['high', 'High'], ['elevated', 'Elevated'], ['moderate', 'Moderate']]

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t) }, [value, ms])
  return v
}

export default function Investigations() {
  const { demo, focusAlertId } = useApp()
  const merchantFor = useMerchantLookup()
  const [tab, setTab] = useState<'register' | 'workspace'>(focusAlertId ? 'workspace' : demo ? 'workspace' : 'register')
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [range, setRange] = useState<DateRange | undefined>()
  const [sort, setSort] = useState('updated')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const debouncedQ = useDebounced(filters.q)
  const effective = useMemo(() => ({ ...filters, q: debouncedQ }), [filters, debouncedQ])
  const enabled = !demo

  const live = useInvestigationsLive(enabled)
  const refetchInterval = live.mode === 'live' ? false : POLL_MS
  const list = useQuery({ queryKey: ['investigations', 'list', effective, sort, dir, page, pageSize], queryFn: () => fetchRegister({ filters: effective, sort, dir, page, pageSize }), enabled, placeholderData: keepPreviousData, refetchInterval })
  const summary = useQuery({ queryKey: ['investigations', 'summary'], queryFn: fetchSummary, enabled, refetchInterval })
  const fetching = useIsFetching({ queryKey: ['investigations'] }) > 0
  const lastOk = Math.max(live.lastSignal ?? 0, list.dataUpdatedAt, summary.dataUpdatedAt) || null
  const rows = list.data?.items ?? []
  const total = list.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / pageSize))

  const change = useCallback((patch: Partial<Filters>) => { setFilters(f => ({ ...f, ...patch })); setPage(1) }, [])
  const onRange = (r: DateRange | undefined) => { setRange(r); change({ start_date: r?.from ? dayKey(r.from) : '', end_date: r?.from ? dayKey(r.to ?? r.from) : '' }) }
  const onSort = (key: string) => { if (key === sort) setDir(d => (d === 'asc' ? 'desc' : 'asc')); else { setSort(key); setDir('desc') } setPage(1) }
  const open = (id: string) => { set({ focusAlertId: id }); setTab('workspace') }
  const toggle = (id: string) => setSelected(s => { const n = new Set(s); if (!n.delete(id)) n.add(id); return n })
  const togglePage = (on: boolean) => setSelected(s => { const n = new Set(s); rows.forEach(r => (on ? n.add(r.id) : n.delete(r.id))); return n })
  const dirty = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS)
  useEffect(() => { if (page > pages) setPage(pages) }, [page, pages])

  const actions = demo ? undefined : (
    <>
      <LiveStatus mode={live.mode} lastOk={lastOk} fetchFailed={list.isError || summary.isError} lastEventKind={live.lastEvent?.kind} onRefresh={() => void live.refresh()} refreshing={fetching} />
      <ExportMenu filters={effective} pageIds={rows.map(r => r.id)} selectedIds={[...selected]} />
    </>
  )

  return (
    <div>
      <PageHeader title="Investigations" description="Live register of every investigation with financial exposure, confirmed loss and audited CSV export" actions={actions} />
      {demo ? (
        <>
          <Alert className="mb-3"><FlaskConical aria-hidden="true" /><AlertTitle>Live register needs the backend</AlertTitle><AlertDescription>Demo mode has no database, so the register, live updates and CSV export are unavailable. The investigation workspace below still works with simulated cases.</AlertDescription></Alert>
          <Workspace />
        </>
      ) : (
        <>
          <InvestigationKpis summary={summary.data} loading={summary.isPending} />
          <Tabs value={tab} onValueChange={v => setTab(v as typeof tab)}>
            <TabsList className="mb-3"><TabsTrigger value="register">Register</TabsTrigger><TabsTrigger value="workspace">Case workspace</TabsTrigger></TabsList>
            <TabsContent value="register">
              <Card className="dash-card gap-3 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-52 flex-1 sm:max-w-xs"><Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input className="h-8 pl-8" aria-label="Search investigations" placeholder="Search ID, merchant, customer, city…" value={filters.q} onChange={e => change({ q: e.target.value })} /></div>
                  <NativeSelect size="sm" aria-label="Filter by status" value={filters.status} onChange={e => change({ status: e.target.value })}>{STATUS_OPTS.map(([v, l]) => <NativeSelectOption key={v} value={v}>{l}</NativeSelectOption>)}</NativeSelect>
                  <NativeSelect size="sm" aria-label="Filter by severity" value={filters.severity} onChange={e => change({ severity: e.target.value })}>{SEV_OPTS.map(([v, l]) => <NativeSelectOption key={v} value={v}>{l}</NativeSelectOption>)}</NativeSelect>
                  <NativeSelect size="sm" aria-label="Filter by analyst" value={filters.analyst_id} onChange={e => change({ analyst_id: e.target.value })}><NativeSelectOption value="">All analysts</NativeSelectOption>{(list.data?.analysts ?? []).map(a => <NativeSelectOption key={a.id} value={a.id}>{a.display_name}</NativeSelectOption>)}</NativeSelect>
                  <DateRangePicker value={range} onChange={onRange} presets={[7, 30]} />
                  {dirty && <Button size="sm" variant="ghost" onClick={() => { setFilters(NO_FILTERS); setRange(undefined); setPage(1) }}><X data-icon="inline-start" />Clear</Button>}
                  <p className="ml-auto text-[11px] text-muted-foreground" aria-live="polite">{selected.size > 0 && <><span className="tech">{selected.size}</span> selected · <button className="underline underline-offset-2 hover:text-foreground" onClick={() => setSelected(new Set())}>clear</button> · </>}<span className="tech">{total.toLocaleString('en-GB')}</span> investigation{total === 1 ? '' : 's'}</p>
                </div>
                {list.isError && !list.data ? <Alert variant="destructive"><AlertTitle>Could not load investigations</AlertTitle><AlertDescription>{list.error instanceof Error ? list.error.message : 'Unknown error'}</AlertDescription></Alert>
                  : !list.isPending && !rows.length ? <EmptyState icon={SearchCheck} title="No investigations match" body={dirty ? 'Try widening or clearing the filters.' : 'New investigations appear here as soon as transactions are flagged.'} />
                  : <div className="overflow-x-auto rounded-[5px] border"><RegisterTable rows={rows} loading={list.isPending} sort={sort} dir={dir} onSort={onSort} selected={selected} onToggle={toggle} onTogglePage={togglePage} merchantFor={merchantFor} onOpen={open} /></div>}
                {list.data?.pii_masked && <p className="text-[10px] text-subtle">IP addresses are masked for your role. Customer references are masked account numbers; names and addresses are never included.</p>}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <label className="flex items-center gap-2">Rows per page<NativeSelect size="sm" aria-label="Rows per page" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}>{SIZES.map(n => <NativeSelectOption key={n} value={n}>{n}</NativeSelectOption>)}</NativeSelect></label>
                  <span className="flex items-center gap-2">
                    <span className="tech">{total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)}</span> of <span className="tech">{total.toLocaleString('en-GB')}</span>
                    <Button size="icon-sm" variant="outline" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft aria-hidden="true" /></Button>
                    <Button size="icon-sm" variant="outline" aria-label="Next page" disabled={page >= pages} onClick={() => setPage(p => p + 1)}><ChevronRight aria-hidden="true" /></Button>
                  </span>
                </div>
              </Card>
            </TabsContent>
            <TabsContent value="workspace"><Workspace /></TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
