import { Activity, ClipboardList, Flame, Hourglass, ShieldAlert, TrendingDown, TriangleAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AnimatedValue } from '@/components/app/animated-value'
import type { Summary } from '@/services/investigations'

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const int = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 })
export function formatResolution(seconds: number): string {
  const m = Math.round(seconds / 60)
  if (m < 1) return '<1 min'
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  return h < 48 ? `${h} h ${m % 60} min` : `${Math.floor(h / 24)} d ${h % 24} h`
}

function Kpi({ label, icon: Icon, tone, note, children }: { label: string; icon: LucideIcon; tone: string; note?: string; children: React.ReactNode }) {
  return (
    <Card className="dash-card gap-0 p-3.5 ring-0" role="group" aria-label={label}>
      <div className="flex items-center gap-2"><span className="grid size-6 place-items-center rounded-md border bg-secondary" style={{ color: tone }}><Icon className="size-[13px]" strokeWidth={1.75} aria-hidden="true" /></span><span className="truncate text-[11px] font-medium text-muted-foreground">{label}</span></div>
      <p className="mt-2.5 text-[22px] leading-none font-semibold tracking-tight">{children}</p>
      {note && <p className="mt-1.5 text-[10px] leading-snug text-subtle">{note}</p>}
    </Card>
  )
}

/** Live analytical counters. Values animate (650ms) whenever the backend figure changes. Money is shown in Geist Mono. */
export function InvestigationKpis({ summary, loading }: { summary?: Summary; loading: boolean }) {
  if (loading || !summary) return <div className="mb-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-7" aria-busy="true">{Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-[88px]" />)}</div>
  const s = summary
  return (
    <div className="mb-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-7">
      <Kpi label="Total Investigations" icon={ClipboardList} tone="#65B9EE"><AnimatedValue value={s.total} format={n => int.format(Math.round(n))} /></Kpi>
      <Kpi label="Active Investigations" icon={Activity} tone="#65B9EE"><AnimatedValue value={s.active} format={n => int.format(Math.round(n))} /></Kpi>
      <Kpi label="High-Risk Investigations" icon={Flame} tone="#E3B866" note="Active, risk score 70+"><AnimatedValue value={s.high_risk} format={n => int.format(Math.round(n))} /></Kpi>
      <Kpi label="Escalated Cases" icon={TriangleAlert} tone="#F0736B"><AnimatedValue value={s.escalated} format={n => int.format(Math.round(n))} /></Kpi>
      <Kpi label="Suspected Exposure" icon={ShieldAlert} tone="#E3B866" note={`Unresolved outgoing GBP${s.exposure_excluded_cases ? ` · ${s.exposure_excluded_cases} case${s.exposure_excluded_cases === 1 ? '' : 's'} not in GBP/debit excluded` : ''}`}>
        <AnimatedValue value={Number(s.suspected_exposure_gbp)} format={n => gbp.format(n)} className="text-[19px]" /></Kpi>
      <Kpi label="Confirmed Fraud Loss" icon={TrendingDown} tone="#F0736B" note="Recorded by analysts on closure"><AnimatedValue value={Number(s.confirmed_loss_gbp)} format={n => gbp.format(n)} className="text-[19px]" /></Kpi>
      <Kpi label="Avg Resolution Time" icon={Hourglass} tone="#BFE8FF" note={s.resolved_count ? `Detection to closure · ${s.resolved_count} closed` : 'No closed cases yet'}>
        {s.avg_resolution_seconds == null ? <span className="tech text-muted-foreground">—</span> : <AnimatedValue value={s.avg_resolution_seconds} format={n => formatResolution(n)} />}</Kpi>
    </div>
  )
}
