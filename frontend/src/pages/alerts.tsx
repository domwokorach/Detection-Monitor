import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowDown, ArrowUp, ArrowUpDown, BellOff, Search } from 'lucide-react'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { ViewIcon } from '@hugeicons/core-free-icons'
import { AlertAnalytics } from '@/components/app/alert-analytics'
import { Icon } from '@/components/app/icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertSheet } from '@/components/app/alert-sheet'
import { EmptyState, ErrorState, Mono, PageHeader, RiskBadge, StatusBadge } from '@/components/app/common'
import { MerchantLogo } from '@/components/app/merchant-logo'
import { useFreshIds } from '@/hooks/use-fresh-ids'
import { refresh, useApp, useMerchantLookup } from '@/store/app'
import { dateTime, money } from '@/lib/format'
import { shortId } from '@/lib/dashboard'
import { riskLevel } from '@/lib/risk'

type Filter = 'ACTIVE' | 'HIGH' | 'ESCALATED' | 'MINE' | 'CLOSED'
type SortKey = 'risk_score' | 'created_at' | 'amount'
const PRIORITY: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 }

export default function Alerts() {
  const { alerts, accounts, user, loaded, error } = useApp()
  const [q, setQ] = useState(''), [sev, setSev] = useState('all')
  const custRef = (id: string) => accounts.find(a => a.id === id)?.account_number_masked ?? '—'
  const analyst = (id: string | null) => (id ? (id === user?.id ? 'You' : `Analyst ${id.slice(-4).toUpperCase()}`) : 'Unassigned')
  const merchantFor = useMerchantLookup()
  const alertIds = useMemo(() => alerts.map(a => a.id), [alerts])
  const fresh = useFreshIds(alertIds)
  const [filter, setFilter] = useState<Filter>('ACTIVE')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'risk_score', dir: -1 })
  const [open, setOpen] = useState<string | null>(null)
  const loading = !loaded && !error

  const scoped = useMemo(() => { const needle = q.trim().toLowerCase(); return alerts.filter(a => (sev === 'all' || riskLevel(a.risk_score) === sev) && (!needle || `${shortId(a.id)} ${a.transaction.counterparty} ${custRef(a.transaction.account_id)}`.toLowerCase().includes(needle))) }, [alerts, q, sev, accounts]) // eslint-disable-line
  const counts = useMemo(() => ({
    ACTIVE: alerts.filter(a => a.status !== 'CLOSED').length, HIGH: alerts.filter(a => a.status !== 'CLOSED' && a.priority === 'HIGH').length,
    ESCALATED: alerts.filter(a => a.status === 'ESCALATED').length, MINE: alerts.filter(a => a.assigned_to === user?.id && a.status !== 'CLOSED').length, CLOSED: alerts.filter(a => a.status === 'CLOSED').length,
  }), [alerts, user])
  const shown = useMemo(() => {
    const pass = (a: (typeof alerts)[number]) => ({ ACTIVE: a.status !== 'CLOSED', HIGH: a.status !== 'CLOSED' && a.priority === 'HIGH', ESCALATED: a.status === 'ESCALATED', MINE: a.assigned_to === user?.id && a.status !== 'CLOSED', CLOSED: a.status === 'CLOSED' })[filter]
    const v = (a: (typeof alerts)[number]) => (sort.key === 'amount' ? Number(a.transaction.amount) : sort.key === 'created_at' ? +new Date(a.created_at) : a.risk_score)
    const needle = q.trim().toLowerCase()
    const match = (a: (typeof alerts)[number]) => (sev === 'all' || riskLevel(a.risk_score) === sev) && (!needle || `${shortId(a.id)} ${a.transaction.counterparty} ${custRef(a.transaction.account_id)}`.toLowerCase().includes(needle))
    return alerts.filter(a => pass(a) && match(a)).sort((x, y) => (v(x) - v(y)) * sort.dir || PRIORITY[y.priority] - PRIORITY[x.priority])
  }, [alerts, filter, sort, user, q, sev, accounts])
  const sortBy = (key: SortKey) => setSort(s => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 }))
  const Head = ({ k, children, className }: { k: SortKey; children: string; className?: string }) => (
    <TableHead className={className} aria-sort={sort.key === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button className="inline-flex items-center gap-1 rounded outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" onClick={() => sortBy(k)}>{children}{sort.key === k ? (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-50" />}</button>
    </TableHead>)
  const tabs: [Filter, string][] = [['ACTIVE', 'Active'], ['HIGH', 'High priority'], ['ESCALATED', 'Escalated'], ['MINE', 'Assigned to me'], ['CLOSED', 'Closed']]

  return (
    <div>
      <PageHeader title="Suspicious Activity Review" description="Fraud alerts ordered by risk and priority" />
      {error && !loaded && <ErrorState message={error} onRetry={() => refresh()} />}
      <AlertAnalytics alerts={scoped} loading={loading} />
      <div className="mb-3 flex flex-wrap gap-2">
        <InputGroup className="h-8 min-w-56 flex-1"><InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon><InputGroupInput aria-label="Search alerts" placeholder="Search alert ID, merchant or customer reference…" value={q} onChange={e => setQ(e.target.value)} /></InputGroup>
        <NativeSelect aria-label="Filter by severity" value={sev} onChange={e => setSev(e.target.value)} className="w-40"><NativeSelectOption value="all">All severities</NativeSelectOption><NativeSelectOption value="critical">Critical</NativeSelectOption><NativeSelectOption value="high">High</NativeSelectOption><NativeSelectOption value="medium">Medium</NativeSelectOption><NativeSelectOption value="low">Low</NativeSelectOption></NativeSelect>
      </div>
      <Tabs value={filter} onValueChange={v => setFilter(v as Filter)}>
        <TabsList className="mb-3 h-auto flex-wrap">{tabs.map(([v, l]) => <TabsTrigger key={v} value={v}>{l}<span className="ml-1 rounded-full bg-muted px-1.5 text-[10px] tnum">{counts[v]}</span></TabsTrigger>)}</TabsList>
      </Tabs>
      <Card className="dash-card p-2">
        {loading ? <div className="space-y-2 p-1" aria-busy="true">{Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-9" />)}</div>
          : !shown.length ? <EmptyState icon={BellOff} title="No alerts here" body="Nothing in this view. Switch filters or check back after new transactions are screened." />
          : (
            <Table>
              <TableHeader><TableRow><TableHead>Alert ID</TableHead><TableHead>Merchant</TableHead><TableHead className="hidden lg:table-cell">Customer ref</TableHead><Head k="amount" className="text-right">Amount (£)</Head><Head k="risk_score">Score</Head><TableHead>Severity</TableHead><Head k="created_at" className="hidden md:table-cell">Detected</Head><TableHead>Status</TableHead><TableHead className="hidden xl:table-cell">Analyst</TableHead><TableHead className="text-right"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
              <TableBody>{shown.map((a, i) => { const m = merchantFor(a.transaction.counterparty), isNew = fresh.has(a.id); return (
                <motion.tr key={a.id} initial={{ opacity: 0, y: isNew ? -10 : 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: isNew ? 0.3 : 0.18, delay: isNew ? 0 : Math.min(i, 10) * 0.02 }} tabIndex={0} aria-label={`Investigate alert ${shortId(a.id)} for ${a.transaction.counterparty}`}
                  className={`cursor-pointer border-b outline-none transition-[background-color,box-shadow] duration-200 hover:bg-muted/50 focus-visible:bg-muted/50 hover:shadow-[inset_2px_0_0_var(--primary)] ${isNew ? 'bg-primary/10' : ''}`} onClick={() => setOpen(a.id)} onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) setOpen(a.id) }}>
                  <TableCell className="whitespace-nowrap"><Mono className="text-hl">{shortId(a.id)}</Mono>{isNew && <Badge className="ml-2 h-4 px-1 text-[9px]">NEW</Badge>}</TableCell>
                  <TableCell className="max-w-[14rem]"><span className="flex items-center gap-2"><MerchantLogo domain={m?.domain} name={a.transaction.counterparty} size={32} /><span className="min-w-0"><span className="block truncate font-medium">{a.transaction.counterparty}</span><span className="block truncate tech text-[10px] text-subtle">{m?.domain ?? 'No verified domain'}</span></span></span></TableCell>
                  <TableCell className="hidden lg:table-cell"><Mono className="text-muted-foreground">{custRef(a.transaction.account_id)}</Mono></TableCell>
                  <TableCell className="tech text-right tabular-nums">{money(a.transaction.amount, a.transaction.currency)}</TableCell>
                  <TableCell><Mono>{a.risk_score}</Mono></TableCell><TableCell><RiskBadge score={a.risk_score} showScore={false} /></TableCell>
                  <TableCell className="tech hidden whitespace-nowrap text-[11px] text-muted-foreground md:table-cell">{dateTime(a.created_at)}</TableCell><TableCell><StatusBadge status={a.status} /></TableCell>
                  <TableCell className="hidden text-[11px] text-muted-foreground xl:table-cell">{analyst(a.assigned_to)}</TableCell>
                  <TableCell className="text-right"><Button size="xs" variant="outline" aria-label={`Review alert ${shortId(a.id)}`} onClick={e => { e.stopPropagation(); setOpen(a.id) }}><Icon icon={ViewIcon} size={12} />Investigate</Button></TableCell>
                </motion.tr>) })}</TableBody>
            </Table>)}
      </Card>
      <AlertSheet alertId={open} onClose={() => setOpen(null)} />
    </div>
  )
}
