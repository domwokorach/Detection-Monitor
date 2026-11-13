import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/** Card shell with the dashboard's title row. */
export function Section({ title, subtitle, aside, children, className }: { title: string; subtitle?: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cn('dash-card p-3.5', className)}>
      <header className="mb-3 flex items-start justify-between gap-3">
        <div><h3 className="text-[13px] font-semibold">{title}</h3>{subtitle && <p className="mt-0.5 text-[11px] text-subtle">{subtitle}</p>}</div>
        {aside}
      </header>
      {children}
    </section>
  )
}

/** Label/value row. A missing value is shown as "Not provided": values are never invented. */
export function Field({ label, value, mono, hint }: { label: string; value?: ReactNode; mono?: boolean; hint?: ReactNode }) {
  const missing = value === null || value === undefined || value === ''
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] text-subtle">{label}</dt>
      <dd className={cn('mt-0.5 min-w-0 text-xs break-words', mono && 'tech', missing && 'text-subtle italic')}>{missing ? 'Not provided' : value}{hint}</dd>
    </div>
  )
}

/** "Observed" telemetry vs "Estimated" inference: the two are never visually merged. */
export function Provenance({ kind }: { kind: 'observed' | 'estimated' }) {
  return kind === 'observed'
    ? <Badge variant="outline" className="border-ok/30 bg-ok/10 font-normal text-ok">Observed telemetry</Badge>
    : <Badge variant="outline" className="border-sev-med/30 bg-sev-med/10 font-normal text-sev-med">Estimated · inferred</Badge>
}

export function MaskedBadge({ what }: { what: string }) {
  return (
    <Tooltip><TooltipTrigger asChild><Badge variant="outline" className="gap-1 font-normal text-muted-foreground"><Lock className="size-3" aria-hidden="true" />Masked</Badge></TooltipTrigger>
      <TooltipContent className="max-w-56">{what} is personal data and is masked for your role. An administrator can view it; each view is audit-logged.</TooltipContent></Tooltip>
  )
}
