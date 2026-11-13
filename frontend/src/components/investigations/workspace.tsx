import { useEffect, useMemo, useState } from 'react'
import { SearchCheck } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { InvestigationDetail } from '@/components/investigation'
import { EmptyState, RiskBadge, StatusBadge } from '@/components/app/common'
import { MerchantLogo } from '@/components/app/merchant-logo'
import { set, useApp, useMerchantLookup } from '@/store/app'
import { money, relative } from '@/lib/format'

export function Workspace() {
  const { alerts, focusAlertId, loaded, error } = useApp()
  const merchantFor = useMerchantLookup()
  const [statusF, setStatusF] = useState('active')
  const [sortK, setSortK] = useState('risk')
  const [selected, setSelected] = useState('')
  const queue = useMemo(() => {
    const rows = alerts.filter(a => statusF === 'all' || (statusF === 'active' ? a.status !== 'CLOSED' : a.status === statusF))
    const by: Record<string, (a: (typeof rows)[number]) => number> = { risk: a => -a.risk_score, newest: a => -+new Date(a.created_at), oldest: a => +new Date(a.created_at), amount: a => -Number(a.transaction.amount) }
    return [...rows].sort((x, y) => by[sortK](x) - by[sortK](y))
  }, [alerts, statusF, sortK])

  // A deep link from another page wins; otherwise default to the top of the queue.
  useEffect(() => {
    if (focusAlertId && alerts.some(a => a.id === focusAlertId)) {
      if (!queue.some(a => a.id === focusAlertId)) setStatusF('all')
      setSelected(focusAlertId); set({ focusAlertId: null })
    } else if (!queue.some(a => a.id === selected)) setSelected(queue[0]?.id ?? '')
  }, [focusAlertId, queue, alerts, selected])
  const loading = !loaded && !error

  return (
    <div>
      <div className="grid gap-3 lg:grid-cols-[minmax(17rem,22rem)_1fr]">
        <Card className="dash-card flex max-h-[calc(100vh-9rem)] flex-col gap-2 p-3" aria-label="Investigation queue">
          <div className="grid grid-cols-2 gap-2">
            <NativeSelect aria-label="Filter cases by status" value={statusF} onChange={e => setStatusF(e.target.value)}>{[['active', 'Active cases'], ['OPEN', 'Open'], ['IN_REVIEW', 'In review'], ['ESCALATED', 'Escalated'], ['CLOSED', 'Closed'], ['all', 'All cases']].map(([v, l]) => <NativeSelectOption key={v} value={v}>{l}</NativeSelectOption>)}</NativeSelect>
            <NativeSelect aria-label="Sort cases" value={sortK} onChange={e => setSortK(e.target.value)}>{[['risk', 'Highest risk'], ['newest', 'Newest'], ['oldest', 'Oldest (SLA)'], ['amount', 'Largest amount']].map(([v, l]) => <NativeSelectOption key={v} value={v}>{l}</NativeSelectOption>)}</NativeSelect>
          </div>
          <p className="text-[11px] text-muted-foreground">{queue.length} case{queue.length === 1 ? '' : 's'}</p>
          {loading ? <div className="space-y-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
            : !queue.length ? <EmptyState icon={SearchCheck} title="Queue is empty" body="No cases match this view." />
            : <ScrollArea className="min-h-0 flex-1"><ul className="space-y-1 pr-2">{queue.map(a => (
              <li key={a.id}><button aria-current={selected === a.id ? 'true' : undefined} onClick={() => setSelected(a.id)}
                className={`w-full rounded-lg border p-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${selected === a.id ? 'border-primary/50 bg-primary/10' : 'border-transparent hover:bg-muted/60'}`}>
                <span className="flex items-center gap-2.5"><MerchantLogo domain={merchantFor(a.transaction.counterparty)?.domain} name={a.transaction.counterparty} size={32} />
                  <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate text-xs font-medium">{a.transaction.counterparty}</span><RiskBadge score={a.risk_score} showScore={false} bands="alert" /></span>
                    <span className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground"><span className="tnum">{money(a.transaction.amount, a.transaction.currency)} · {relative(a.created_at)}</span><StatusBadge status={a.status} /></span></span></span>
              </button></li>))}</ul></ScrollArea>}
        </Card>
        <section aria-label="Case details" className="min-w-0">
          {!selected ? <EmptyState icon={SearchCheck} title="Select a case" body="Choose an alert from the queue to review its evidence and take action." /> : <InvestigationDetail alertId={selected} />}
        </section>
      </div>
    </div>
  )
}
