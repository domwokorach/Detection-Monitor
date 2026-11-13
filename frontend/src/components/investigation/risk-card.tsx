import { CircleCheck, CircleHelp, Flag, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ALERT_RISK_META, alertRiskLevel } from '@/lib/risk'
import type { AlertDetail, Investigation } from '@/types'
import { shortId } from '@/lib/dashboard'
import { dateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Mono, StatusBadge } from '@/components/app/common'
import { openAlert } from '@/store/app'
import { Section } from './shared'

const STATE = {
  flagged: { Icon: Flag, tone: 'text-sev-high border-sev-high/30 bg-sev-high/10', label: 'Flagged' },
  clear: { Icon: CircleCheck, tone: 'text-ok border-ok/30 bg-ok/10', label: 'Clear' },
  unavailable: { Icon: CircleHelp, tone: 'text-subtle border-border bg-muted', label: 'Data unavailable' },
} as const

export function RiskCard({ inv, detail }: { inv: Investigation; detail: AlertDetail | null }) {
  const score = detail?.risk_score ?? 0, meta = ALERT_RISK_META[alertRiskLevel(score)]
  return (
    <Section title="Risk Analysis" subtitle="The score is the sum of triggered rule weights; context signals below are supporting evidence only">
      {detail && <div className="mb-3 flex items-center gap-3">
        <div className="tnum text-3xl font-semibold" style={{ color: meta.color }} aria-label={`Fraud risk score ${score} of 100, ${meta.label}`}>{score}<span className="text-sm text-subtle">/100</span></div>
        <div className="flex-1"><div className="h-1.5 overflow-hidden rounded-full bg-muted" role="presentation"><div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${score}%`, background: meta.color }} /></div><p className="mt-1 text-[11px]" style={{ color: meta.color }}>{meta.label} severity</p></div>
      </div>}

      <h4 className="mb-1.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">Triggered rules</h4>
      {detail?.matches.length ? <ul className="space-y-2">{detail.matches.map(m => (
        <li key={m.id} className="rounded-lg border p-2.5"><div className="flex items-center justify-between gap-2"><Mono className="text-primary">{m.rule_code} <span className="text-subtle">v{m.rule_version}</span></Mono><span className="tech rounded bg-sev-crit/15 px-1.5 py-0.5 text-[11px] text-sev-crit">+{m.score}</span></div>
          <p className="mt-1 text-xs">{m.reason}</p><p className="mt-1 truncate tech text-[10px] text-subtle">rule config at match time: {JSON.stringify(m.rule_config_snapshot)}</p></li>))}</ul>
        : <p className="text-[11px] text-subtle italic">No rule matches were recorded for this alert.</p>}

      <h4 className="mt-4 mb-1.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">Context signals</h4>
      <ul className="divide-y rounded-lg border">{inv.factors.map(f => { const s = STATE[f.status]; return (
        <li key={f.code} className="flex items-start gap-2.5 p-2.5">
          <span className={cn('mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium', s.tone)}><s.Icon className="size-3" aria-hidden="true" />{s.label}</span>
          <div className="min-w-0"><p className="text-xs font-medium">{f.label}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{f.explanation}</p>{f.evidence && <p className="mt-0.5 text-[10.5px] text-subtle">{f.evidence}</p>}</div>
        </li>) })}</ul>

      <h4 className="mt-4 mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-subtle uppercase"><Link2 className="size-3" aria-hidden="true" />Linked suspicious investigations ({inv.linked.length})</h4>
      {inv.linked.length ? <ul className="divide-y rounded-lg border">{inv.linked.map(l => (
        <li key={l.alert_id}><Button variant="ghost" className="h-auto w-full justify-between gap-3 rounded-none px-2.5 py-2 text-left font-normal" onClick={() => openAlert(l.alert_id)}>
          <span className="min-w-0"><Mono>{shortId(l.alert_id)}</Mono><span className="ml-2 text-xs">{l.counterparty}</span><span className="block text-[10.5px] text-subtle">{l.reason} · {dateTime(l.created_at)}</span></span>
          <span className="flex items-center gap-2"><span className="tnum text-xs" style={{ color: ALERT_RISK_META[alertRiskLevel(l.risk_score)].color }}>{l.risk_score}</span><StatusBadge status={l.status} /></span></Button></li>))}</ul>
        : <p className="text-[11px] text-subtle italic">No other suspicious investigations share this IP, account or merchant name.</p>}
    </Section>
  )
}
