import { Download, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ErrorState, PageHeader } from '@/components/app/common'
import { refresh, useApp } from '@/store/app'

const cell = (v: unknown) => { const s = v == null ? '' : String(v); return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s }
const csv = (rows: Record<string, unknown>[]) => {
  if (!rows.length) return ''
  const cols = Object.keys(rows[0]), q = (v: unknown) => `"${cell(v).replace(/"/g, '""')}"`
  return [cols.join(','), ...rows.map(r => cols.map(c => q(r[c])).join(','))].join('\n')
}
function download(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) { toast.info('Nothing to export yet'); return }
  const url = URL.createObjectURL(new Blob([csv(rows)], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: `detection-monitor-${name}-${new Date().toISOString().slice(0, 10)}.csv` })
  a.click(); URL.revokeObjectURL(url); toast.success(`${name} exported`)
}

export default function Reports() {
  const { alerts, transactions, audit, loaded, error } = useApp()
  const reports = [
    { name: 'alerts', title: 'Suspicious Activity Review', body: 'Every alert with priority, status, score and disposition.', count: alerts.length,
      rows: () => alerts.map(a => ({ alert_id: a.id, status: a.status, priority: a.priority, risk_score: a.risk_score, disposition: a.disposition ?? '', counterparty: a.transaction.counterparty, amount: a.transaction.amount, currency: a.transaction.currency, created_at: a.created_at })) },
    { name: 'transactions', title: 'Monitored Transactions', body: 'Screened transactions with risk score and status.', count: transactions.length,
      rows: () => transactions.map(t => ({ id: t.external_id, counterparty: t.counterparty, country: t.country, amount: t.amount, currency: t.currency, direction: t.direction, risk_score: t.risk_score, status: t.screening_status, occurred_at: t.occurred_at })) },
    { name: 'audit', title: 'Audit Trail', body: 'Hash-linked analyst and system activity.', count: audit.length,
      rows: () => audit.map(e => ({ seq: e.seq, actor: e.actor, action: e.action, entity_type: e.entity_type, entity_id: e.entity_id, created_at: e.created_at, entry_hash: e.entry_hash })) },
  ]
  return (
    <div>
      <PageHeader title="Reports" description="Export operational datasets for compliance review (CSV)" />
      {error && !loaded && <ErrorState message={error} onRetry={() => refresh()} />}
      <div className="grid gap-3 md:grid-cols-3">{reports.map(r => (
        <Card key={r.name} className="dash-card gap-3 p-4">
          <span className="grid size-8 place-items-center rounded-md border bg-secondary text-hl"><FileText className="size-4" aria-hidden="true" /></span>
          <div><h2 className="text-[13px] font-semibold">{r.title}</h2><p className="mt-1 text-[11px] text-muted-foreground">{r.body}</p></div>
          <div className="mt-auto flex items-center justify-between"><span className="tech text-[11px] text-subtle">{r.count.toLocaleString()} records</span>
            <Button size="sm" variant="outline" disabled={!loaded} onClick={() => download(r.name, r.rows())}><Download data-icon="inline-start" />Export CSV</Button></div>
        </Card>))}</div>
    </div>
  )
}
