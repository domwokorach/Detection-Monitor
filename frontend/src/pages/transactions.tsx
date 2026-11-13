import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowDown, ArrowUp, ArrowUpDown, Copy, FilterX, MoreHorizontal, ReceiptText, Search, ShieldAlert, Siren, Store } from 'lucide-react'
import { toast } from 'sonner'
import type { DateRange } from 'react-day-picker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from '@/components/ui/pagination'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DateRangePicker } from '@/components/app/date-range-picker'
import { EmptyState, ErrorState, Mono, PageHeader, RiskBadge, StatusBadge } from '@/components/app/common'
import { MerchantIdentity, MerchantPanel } from '@/components/app/merchant'
import { useFreshIds } from '@/hooks/use-fresh-ids'
import { api, openAlert, refresh, set, useApp, useMerchantLookup } from '@/store/app'
import { dateTime, money, relative } from '@/lib/format'
import { normalizeName } from '@/lib/merchant'
import type { Match, Transaction } from '@/types'

const PAGE_SIZE = 20
type SortKey = 'occurred_at' | 'amount' | 'risk_score'

export default function Transactions() {
  const { transactions, accounts, alerts, merchants, search, loaded, error, live } = useApp()
  const merchantFor = useMerchantLookup()
  const [range, setRange] = useState<DateRange | undefined>()
  const [f, setF] = useState({ min: '', max: '', country: 'all', risk: 'all', status: 'all', merchant: 'all' })
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'occurred_at', dir: -1 })
  const [pageNo, setPageNo] = useState(1)
  const [selected, setSelected] = useState<Transaction | null>(null)
  const accountName = (id: string) => accounts.find(a => a.id === id)?.holder_name ?? id
  const countries = useMemo(() => [...new Set(transactions.map(t => t.country))].sort(), [transactions])

  const txIds = useMemo(() => transactions.map(t => t.id), [transactions])
  const fresh = useFreshIds(txIds)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const from = range?.from ? new Date(range.from).setHours(0, 0, 0, 0) : -Infinity
    const to = range?.to ? new Date(range.to).setHours(23, 59, 59, 999) : range?.from ? new Date(range.from).setHours(23, 59, 59, 999) : Infinity
    const min = f.min === '' ? -Infinity : Number(f.min), max = f.max === '' ? Infinity : Number(f.max)
    const rows = transactions.filter(t => {
      const when = +new Date(t.occurred_at), amt = Number(t.amount)
      return when >= from && when <= to && amt >= min && amt <= max && (f.country === 'all' || t.country === f.country)
        && t.risk_score >= Number(f.risk === 'all' ? 0 : f.risk) && (f.status === 'all' || t.screening_status === f.status)
        && (f.merchant === 'all' || (f.merchant === 'unresolved' ? !merchantFor(t.counterparty) : normalizeName(t.counterparty) === f.merchant))
        && (!q || `${t.external_id} ${t.counterparty} ${merchantFor(t.counterparty)?.domain ?? ''} ${t.country} ${accountName(t.account_id)}`.toLowerCase().includes(q))
    })
    const v = (t: Transaction) => (sort.key === 'amount' ? Number(t.amount) : sort.key === 'risk_score' ? t.risk_score : +new Date(t.occurred_at))
    return rows.sort((a, b) => (v(a) - v(b)) * sort.dir)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, search, range, f, sort, accounts, merchants])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  useEffect(() => { setPageNo(1) }, [search, range, f])
  useEffect(() => { if (pageNo > pages) setPageNo(pages) }, [pages, pageNo])
  const visible = filtered.slice((pageNo - 1) * PAGE_SIZE, pageNo * PAGE_SIZE)
  const active = !!search || !!range || Object.values(f).some(v => v !== '' && v !== 'all')
  const clear = () => { setRange(undefined); setF({ min: '', max: '', country: 'all', risk: 'all', status: 'all', merchant: 'all' }); set({ search: '' }) }
  const loading = !loaded && !error
  const sortBy = (key: SortKey) => setSort(s => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 }))
  const SortHead = ({ k, children, className }: { k: SortKey; children: string; className?: string }) => (
    <TableHead className={className} aria-sort={sort.key === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button className="inline-flex items-center gap-1 rounded outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" onClick={() => sortBy(k)}>{children}{sort.key === k ? (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-50" />}</button>
    </TableHead>)
  const alertFor = (t: Transaction) => alerts.find(a => a.transaction_id === t.id)
  const relatedTo = (t: Transaction) => transactions.filter(o => o.id !== t.id && normalizeName(o.counterparty) === normalizeName(t.counterparty))

  return (
    <div>
      <PageHeader title="Transaction Monitoring" description={`${filtered.length.toLocaleString()} of ${transactions.length.toLocaleString()} transactions`}
        actions={<><Badge variant="outline" className="gap-1.5 font-normal text-muted-foreground"><span className={`size-1.5 rounded-full ${live ? 'bg-ok' : 'bg-sev-med'}`} aria-hidden="true" />Live stream</Badge><DateRangePicker value={range} onChange={setRange} presets={[1, 7, 14]} />
          <Button size="sm" variant="ghost" disabled={!active} onClick={clear}><FilterX data-icon="inline-start" />Clear</Button></>} />
      {error && !loaded && <ErrorState message={error} onRetry={() => refresh()} />}
      <Card className="dash-card gap-3 p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
          <InputGroup className="h-8 sm:col-span-2"><InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon><InputGroupInput aria-label="Search transactions" placeholder="Reference, merchant, domain, account…" value={search} onChange={e => set({ search: e.target.value })} /></InputGroup>
          <div className="flex gap-2"><Input type="number" min={0} inputMode="decimal" aria-label="Minimum amount" placeholder="Min £" value={f.min} onChange={e => setF({ ...f, min: e.target.value })} className="h-8" /><Input type="number" min={0} inputMode="decimal" aria-label="Maximum amount" placeholder="Max £" value={f.max} onChange={e => setF({ ...f, max: e.target.value })} className="h-8" /></div>
          <NativeSelect aria-label="Country" value={f.country} onChange={e => setF({ ...f, country: e.target.value })}><NativeSelectOption value="all">All countries</NativeSelectOption>{countries.map(c => <NativeSelectOption key={c} value={c}>{c}</NativeSelectOption>)}</NativeSelect>
          <Select value={f.merchant} onValueChange={v => setF({ ...f, merchant: v })}>
            <SelectTrigger aria-label="Merchant" className="h-8 w-full"><Store className="size-3.5 text-subtle" aria-hidden="true" /><SelectValue placeholder="All merchants" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All merchants</SelectItem><SelectItem value="unresolved">Unresolved domain</SelectItem>{merchants.map(m => <SelectItem key={m.id} value={m.normalized_name}>{m.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={f.risk} onValueChange={v => setF({ ...f, risk: v })}>
            <SelectTrigger aria-label="Minimum risk score" className="h-8 w-full"><SelectValue placeholder="Any risk score" /></SelectTrigger>
            <SelectContent>{[['all', 'Any risk score'], ['40', '40+ Moderate'], ['60', '60+ Elevated'], ['70', '70+ High'], ['85', '85+ Critical']].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
          </Select>
          <NativeSelect aria-label="Screening status" value={f.status} onChange={e => setF({ ...f, status: e.target.value })}>{[['all', 'Any status'], ['SCREENED', 'Screened'], ['PENDING', 'Pending'], ['FAILED', 'Failed']].map(([v, l]) => <NativeSelectOption key={v} value={v}>{l}</NativeSelectOption>)}</NativeSelect>
        </div>

        {loading ? <div className="space-y-2" aria-busy="true" aria-label="Loading transactions">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-9" />)}</div>
          : !filtered.length ? <EmptyState icon={ReceiptText} title={transactions.length ? 'No transactions match these filters' : 'No transactions yet'} body={transactions.length ? 'Try widening the date range or clearing filters.' : 'Transactions ingested through POST /api/transactions appear here.'}>{active && <Button size="sm" variant="outline" onClick={clear}>Clear filters</Button>}</EmptyState>
          : (
            <Table>
              <TableHeader><TableRow><TableHead>Merchant</TableHead><TableHead>Reference</TableHead><TableHead className="hidden md:table-cell">Account</TableHead><SortHead k="amount" className="text-right">Amount</SortHead><SortHead k="risk_score">Risk</SortHead><SortHead k="occurred_at" className="hidden lg:table-cell">When</SortHead><TableHead className="hidden sm:table-cell">Status</TableHead><TableHead className="w-10"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
              <TableBody>{visible.map((t, i) => { const suspicious = t.risk_score >= 60; return (
                <motion.tr key={t.id} initial={{ opacity: 0, y: fresh.has(t.id) ? -10 : 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, delay: Math.min(i, 10) * 0.02 }} tabIndex={0} aria-label={`${suspicious ? 'Suspicious transaction ' : 'Transaction '}${t.external_id} with ${t.counterparty}`}
                  className={`cursor-pointer border-b outline-none transition-colors duration-500 hover:bg-muted/50 focus-visible:bg-muted/50 ${fresh.has(t.id) ? 'bg-primary/10' : suspicious ? 'bg-sev-crit/[0.04]' : ''}`} onClick={() => setSelected(t)} onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) setSelected(t) }}>
                  <TableCell className={`max-w-[14rem] ${suspicious ? 'shadow-[inset_2px_0_0_var(--sev-high)]' : ''}`}><MerchantIdentity counterparty={t.counterparty} showDomain />{suspicious && <span className="sr-only">Suspicious</span>}</TableCell>
                  <TableCell><Mono>{t.external_id}</Mono>{fresh.has(t.id) && <Badge className="ml-2 h-4 px-1 text-[9px]">NEW</Badge>}<span className="block text-[10px] text-subtle">{t.country}</span></TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{accountName(t.account_id)}</TableCell>
                  <TableCell className="text-right tnum">{t.direction === 'CREDIT' ? '+' : '−'}{money(t.amount, t.currency)}</TableCell>
                  <TableCell><RiskBadge score={t.risk_score} bands="alert" /></TableCell><TableCell className="tech hidden whitespace-nowrap text-[11px] text-muted-foreground lg:table-cell">{dateTime(t.occurred_at)}</TableCell><TableCell className="hidden sm:table-cell"><StatusBadge status={t.screening_status} /></TableCell>
                  <TableCell className="w-10 pl-0" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                    <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon-sm" variant="ghost" aria-label={`Actions for ${t.external_id}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end"><DropdownMenuLabel className="truncate">{t.counterparty}</DropdownMenuLabel><DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => setSelected(t)}><Store />Company details</DropdownMenuItem>
                        {alertFor(t) && <DropdownMenuItem onSelect={() => openAlert(alertFor(t)!.id)}><Siren />Investigate alert</DropdownMenuItem>}
                        <DropdownMenuItem onSelect={() => setF(p => ({ ...p, merchant: normalizeName(t.counterparty) }))}><Search />Filter to this merchant</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => { void navigator.clipboard?.writeText(t.external_id).then(() => toast.success('Reference copied'), () => toast.error('Could not copy')) }}><Copy />Copy reference</DropdownMenuItem>
                      </DropdownMenuContent></DropdownMenu>
                  </TableCell>
                </motion.tr>) })}</TableBody>
            </Table>)}

        {filtered.length > PAGE_SIZE && (
          <Pagination className="justify-between"><span className="text-[11px] text-muted-foreground">Page {pageNo} of {pages}</span>
            <PaginationContent><PaginationItem><PaginationPrevious href="#" onClick={e => { e.preventDefault(); setPageNo(p => Math.max(1, p - 1)) }} aria-disabled={pageNo <= 1} /></PaginationItem><PaginationItem><PaginationNext href="#" onClick={e => { e.preventDefault(); setPageNo(p => Math.min(pages, p + 1)) }} aria-disabled={pageNo >= pages} /></PaginationItem></PaginationContent></Pagination>)}
      </Card>

      <Sheet open={!!selected} onOpenChange={o => { if (!o) setSelected(null) }}>
        <SheetContent className="gap-0 sm:max-w-md">
          <SheetHeader className="border-b"><SheetTitle>Company details</SheetTitle><SheetDescription className="tech">{selected?.external_id}</SheetDescription></SheetHeader>
          <ScrollArea className="min-h-0 flex-1">
            {selected && <div className="space-y-4 p-4">
              <MerchantPanel counterparty={selected.counterparty} />
              <div className="dash-card p-4 text-center"><p className="text-3xl font-semibold tracking-tight tnum">{money(selected.amount, selected.currency)}</p><p className="mt-1 text-xs text-muted-foreground">{selected.direction === 'DEBIT' ? 'Outgoing to' : 'Incoming from'} {selected.counterparty}</p><div className="mt-3 flex justify-center gap-2"><RiskBadge score={selected.risk_score} bands="alert" /><StatusBadge status={selected.screening_status} /></div></div>
              <Tabs defaultValue="overview" key={selected.id}>
                <TabsList className="w-full"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="history">History ({relatedTo(selected).length})</TabsTrigger><TabsTrigger value="rules">Rule matches</TabsTrigger></TabsList>
                <TabsContent value="overview" className="mt-3 space-y-3">{(() => { const acc = accounts.find(a => a.id === selected.account_id), al = alertFor(selected); return (<>
                  <dl className="grid grid-cols-2 gap-3 text-xs">
                    <div><dt className="text-subtle">Account</dt><dd className="mt-0.5">{acc?.holder_name ?? selected.account_id}</dd></div><div><dt className="text-subtle">Account number</dt><dd className="mt-0.5 tech">{acc?.account_number_masked ?? '—'}</dd></div>
                    <div><dt className="text-subtle">Destination</dt><dd className="mt-0.5">{selected.country}{acc && acc.home_country !== selected.country && <span className="text-sev-med"> (≠ home {acc.home_country})</span>}</dd></div><div><dt className="text-subtle">Occurred</dt><dd className="mt-0.5 tech">{dateTime(selected.occurred_at)}</dd></div>
                  </dl>
                  {al ? <Button className="w-full" onClick={() => { setSelected(null); openAlert(al.id) }}>Investigate alert</Button> : <p className="rounded-lg border bg-secondary/40 p-3 text-center text-xs text-muted-foreground">No alert was raised for this transaction.</p>}</>) })()}</TabsContent>
                <TabsContent value="history" className="mt-3">{relatedTo(selected).length
                  ? <ul className="divide-y rounded-lg border">{relatedTo(selected).slice(0, 8).map(o => <li key={o.id}><button className="flex w-full items-center justify-between gap-3 p-2.5 text-left text-xs outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50" onClick={() => setSelected(o)}><span><Mono>{o.external_id}</Mono><span className="block text-[10px] text-subtle">{relative(o.occurred_at)}</span></span><span className="flex items-center gap-2"><span className="tnum">{money(o.amount, o.currency)}</span><RiskBadge score={o.risk_score} showScore={false} bands="alert" /></span></button></li>)}</ul>
                  : <EmptyState icon={ReceiptText} title="No earlier transactions" body="This is the only transaction recorded with this counterparty name." />}</TabsContent>
                <TabsContent value="rules" className="mt-3"><RuleMatches id={selected.id} /></TabsContent>
              </Tabs>
            </div>}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  )
}

/** Rule evidence for one transaction, loaded on demand from GET /api/transactions/{id}. */
function RuleMatches({ id }: { id: string }) {
  const [matches, setMatches] = useState<Match[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    setMatches(null); setFailed(false)
    api().transaction(id).then(d => { if (live) setMatches(d.matches) }).catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [id])
  if (failed) return <p className="text-xs text-muted-foreground">Rule matches could not be loaded.</p>
  if (!matches) return <div className="space-y-2" aria-busy="true"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
  if (!matches.length) return <EmptyState icon={ShieldAlert} title="No rules matched" body="Screening recorded no rule matches for this transaction." />
  return <ul className="space-y-2">{matches.map(m => <li key={m.id} className="dash-card p-3"><div className="flex items-center justify-between gap-2"><Mono className="text-primary">{m.rule_code} <span className="text-subtle">v{m.rule_version}</span></Mono><span className="tech rounded bg-sev-crit/15 px-1.5 py-0.5 text-[11px] text-sev-crit">+{m.score}</span></div><p className="mt-1.5 text-xs">{m.reason}</p></li>)}</ul>
}
