import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RiskBadge, StatusBadge } from '@/components/app/common'
import { MerchantLogo } from '@/components/app/merchant-logo'
import { money } from '@/lib/format'
import { londonShort, utcTime } from '@/lib/time'
import { cn } from '@/lib/utils'
import type { RegisterRow } from '@/services/investigations'
import type { Merchant } from '@/types'

type Col = { label: string; sort?: string; right?: boolean; cell: (r: RegisterRow, ctx: Ctx) => React.ReactNode }
type Ctx = { merchantFor: (name: string) => Merchant | undefined; open: (id: string) => void }

const mono = 'tech text-[11.5px]'
const dash = <span className="text-subtle">—</span>
const Ts = ({ iso }: { iso: string | null }) => iso ? <time dateTime={iso} title={utcTime(iso)} className={cn(mono, 'whitespace-nowrap')}>{londonShort(iso)}</time> : dash
const Money = ({ v, cur = 'GBP', tone }: { v: string | null; cur?: string; tone?: string }) => v == null ? dash : <span className={cn(mono, 'whitespace-nowrap', tone)}>{money(v, cur)}</span>

const COLS: Col[] = [
  { label: 'Investigation', sort: 'detected', cell: (r, c) => <button className={cn(mono, 'rounded-[5px] text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring')} title={r.id} onClick={() => c.open(r.id)}>{r.case_ref}</button> },
  { label: 'Customer ref', cell: r => <span className={mono}>{r.customer_reference}</span> },
  { label: 'Merchant', sort: 'merchant', cell: (r, c) => <span className="flex min-w-40 items-center gap-2"><MerchantLogo domain={c.merchantFor(r.merchant_name)?.domain} name={r.merchant_name} size={24} /><span className="truncate text-xs">{r.merchant_name}</span></span> },
  { label: 'Transaction ID', cell: r => <span className={mono}>{r.transaction_id}</span> },
  { label: 'Amount', sort: 'amount', right: true, cell: r => <Money v={r.amount} cur={r.currency} /> },
  { label: 'Suspected exposure', right: true, cell: r => <Money v={r.suspected_exposure} tone="text-sev-med" /> },
  { label: 'Confirmed loss', right: true, cell: r => <Money v={r.confirmed_loss} tone="text-sev-crit" /> },
  { label: 'Risk', sort: 'risk', right: true, cell: r => <span className={mono}>{r.risk_score}</span> },
  { label: 'Severity', cell: r => <RiskBadge score={r.risk_score} showScore={false} bands="alert" /> },
  { label: 'IP address', cell: r => r.ip_address ? <span className={mono} title={r.ip_masked ? 'Masked for your role' : undefined}>{r.ip_address}</span> : dash },
  { label: 'City / county', cell: r => r.city || r.county ? <span className="text-xs whitespace-nowrap">{[r.city, r.county].filter(Boolean).join(', ')}</span> : r.la_code ? <span className={cn(mono, 'text-muted-foreground')} title="Local authority code">LA {r.la_code}</span> : dash },
  { label: 'Transaction time', sort: 'transaction_time', cell: r => <Ts iso={r.transaction_time} /> },
  { label: 'Alert detected', sort: 'detected', cell: r => <Ts iso={r.detected_at} /> },
  { label: 'Opened', sort: 'opened', cell: r => <Ts iso={r.opened_at} /> },
  { label: 'Last updated', sort: 'updated', cell: r => <Ts iso={r.last_updated} /> },
  { label: 'Analyst', sort: 'analyst', cell: r => r.assigned_to ? <span className="text-xs whitespace-nowrap">{r.assigned_to.display_name}</span> : <span className="text-xs text-subtle">Unassigned</span> },
  { label: 'Status', sort: 'status', cell: r => <StatusBadge status={r.status} /> },
]

export function RegisterTable({ rows, loading, sort, dir, onSort, selected, onToggle, onTogglePage, merchantFor, onOpen }: {
  rows: RegisterRow[]; loading: boolean; sort: string; dir: 'asc' | 'desc'; onSort: (key: string) => void
  selected: Set<string>; onToggle: (id: string) => void; onTogglePage: (on: boolean) => void
  merchantFor: Ctx['merchantFor']; onOpen: (id: string) => void
}) {
  const allOn = rows.length > 0 && rows.every(r => selected.has(r.id)), someOn = rows.some(r => selected.has(r.id))
  return (
    <Table aria-label="Investigations register" aria-busy={loading}>
      <TableHeader>
        <TableRow>
          <TableHead className="w-9 pr-0"><Checkbox aria-label="Select all on this page" checked={allOn ? true : someOn ? 'indeterminate' : false} onCheckedChange={v => onTogglePage(v === true)} /></TableHead>
          {COLS.map(c => (
            <TableHead key={c.label} className={cn('text-[11px] whitespace-nowrap', c.right && 'text-right')} aria-sort={c.sort && c.sort === sort ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}>
              {c.sort ? (
                <button className={cn('inline-flex items-center gap-1 rounded-[5px] outline-none transition-colors duration-200 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring', c.right && 'flex-row-reverse')} onClick={() => onSort(c.sort!)}>
                  {c.label}{c.sort === sort ? (dir === 'asc' ? <ArrowUp className="size-3" aria-hidden="true" /> : <ArrowDown className="size-3" aria-hidden="true" />) : <ChevronsUpDown className="size-3 opacity-40" aria-hidden="true" />}
                </button>
              ) : c.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading && !rows.length ? Array.from({ length: 6 }, (_, i) => <TableRow key={i}><TableCell colSpan={COLS.length + 1}><Skeleton className="h-6" /></TableCell></TableRow>)
          : rows.map(r => (
            <TableRow key={r.id} data-state={selected.has(r.id) ? 'selected' : undefined} className="transition-colors duration-200">
              <TableCell className="pr-0"><Checkbox aria-label={`Select ${r.case_ref}`} checked={selected.has(r.id)} onCheckedChange={() => onToggle(r.id)} /></TableCell>
              {COLS.map(c => <TableCell key={c.label} className={cn(c.right && 'text-right')}>{c.cell(r, { merchantFor, open: onOpen })}</TableCell>)}
            </TableRow>
          ))}
      </TableBody>
    </Table>
  )
}
