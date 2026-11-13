import { motion } from 'motion/react'
import { FolderOpen } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState, Mono, PageHeader, RiskBadge } from '@/components/app/common'
import { openAlert, refresh, useApp } from '@/store/app'
import { ago, shortId } from '@/lib/dashboard'
import { money } from '@/lib/format'
import type { AlertStatus } from '@/types'

const COLUMNS: { key: AlertStatus; title: string; hint: string }[] = [
  { key: 'OPEN', title: 'Awaiting Triage', hint: 'Unassigned and new' },
  { key: 'IN_REVIEW', title: 'In Review', hint: 'Analyst working' },
  { key: 'ESCALATED', title: 'Escalated Cases', hint: 'Senior review' },
  { key: 'CLOSED', title: 'Closed', hint: 'Disposition recorded' },
]

export default function Cases() {
  const { alerts, loaded, error } = useApp()
  const loading = !loaded && !error
  return (
    <div>
      <PageHeader title="Case Management" description="Investigation workflow from triage to disposition" />
      {error && !loaded && <ErrorState message={error} onRetry={() => refresh()} />}
      {loading ? <div className="grid gap-3 lg:grid-cols-4" aria-busy="true">{COLUMNS.map(c => <Skeleton key={c.key} className="h-72 rounded-[10px]" />)}</div>
        : !alerts.length ? <Card className="dash-card"><EmptyState icon={FolderOpen} title="No cases yet" body="Cases open automatically when alerts are raised." /></Card>
        : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{COLUMNS.map((c, ci) => {
          const items = alerts.filter(a => a.status === c.key).sort((a, b) => b.risk_score - a.risk_score).slice(0, 12)
          const total = alerts.filter(a => a.status === c.key).length
          return (
            <motion.section key={c.key} aria-label={c.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: ci * 0.06 }} className="dash-card flex min-h-64 flex-col gap-2 p-2.5">
              <header className="flex items-baseline justify-between px-1"><div><h2 className="text-[13px] font-semibold">{c.title}</h2><p className="text-[10px] text-subtle">{c.hint}</p></div><span className="tnum text-base font-semibold">{total}</span></header>
              <ul className="space-y-1.5">
                {items.map(a => (
                  <li key={a.id}><button onClick={() => openAlert(a.id)} className="w-full rounded-lg border bg-background/40 p-2 text-left outline-none transition hover:-translate-y-px hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring">
                    <div className="flex items-center justify-between"><Mono className="text-hl">{shortId(a.id, 'CASE')}</Mono><RiskBadge score={a.risk_score} /></div>
                    <p className="mt-1.5 truncate text-[11px]">{a.transaction.counterparty}</p>
                    <p className="mt-0.5 flex justify-between text-[10px] text-subtle tnum"><span>{money(Number(a.transaction.amount), a.transaction.currency)}</span><span>{ago(a.updated_at)}</span></p>
                  </button></li>))}
                {!items.length && <li className="py-6 text-center text-[11px] text-subtle">No cases</li>}
                {total > items.length && <li className="pt-1 text-center text-[10px] text-subtle">+{total - items.length} more in Alerts</li>}
              </ul>
            </motion.section>)
        })}</div>}
    </div>
  )
}
