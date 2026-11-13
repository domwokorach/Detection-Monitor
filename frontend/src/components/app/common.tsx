import { useEffect, useRef, useState, type ReactNode } from 'react'
import { animate, motion, useReducedMotion } from 'motion/react'
import { TriangleAlert, RotateCw, type LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { ALERT_RISK_META, RISK_META, alertRiskLevel, riskLevel } from '@/lib/risk'
import { titleCase } from '@/lib/format'

/** Number that eases to its value; instant under prefers-reduced-motion. */
export function CountUp({ value, decimals = 0, suffix = '' }: { value: number; decimals?: number; suffix?: string }) {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(reduced ? value : 0)
  const from = useRef(0)
  useEffect(() => {
    if (reduced) { setShown(value); return }
    const controls = animate(from.current, value, { duration: 0.8, ease: 'easeOut', onUpdate: v => { from.current = v; setShown(v) } })
    return () => controls.stop()
  }, [value, reduced])
  return <span className="tnum">{shown.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>
}

/** Risk badge: colour plus a text label and glyph so severity never relies on colour alone. */
export function RiskBadge({ score, showScore = true, bands = 'default' }: { score: number; showScore?: boolean; bands?: 'default' | 'alert' }) {
  const m = bands === 'alert' ? ALERT_RISK_META[alertRiskLevel(score)] : RISK_META[riskLevel(score)]
  return (
    <Badge variant="outline" className="gap-1 font-medium tnum" style={{ color: m.color, borderColor: `color-mix(in srgb, ${m.color} 40%, transparent)`, background: `color-mix(in srgb, ${m.color} 12%, transparent)` }}>
      <span aria-hidden="true" className="text-[8px] leading-none">{m.glyph}</span>{m.label}{showScore && <span className="tech opacity-80">{score}</span>}
    </Badge>
  )
}

const STATUS_TONE: Record<string, string> = {
  OPEN: 'text-hl border-hl/30 bg-hl/10', IN_REVIEW: 'text-primary border-primary/30 bg-primary/10', ESCALATED: 'text-sev-crit border-sev-crit/30 bg-sev-crit/10',
  CLOSED: 'text-muted-foreground border-border bg-muted', SCREENED: 'text-ok border-ok/30 bg-ok/10', PENDING: 'text-sev-med border-sev-med/30 bg-sev-med/10', FAILED: 'text-sev-crit border-sev-crit/30 bg-sev-crit/10',
}
export function StatusBadge({ status }: { status: string }) {
  return <Badge variant="outline" className={cn('font-medium', STATUS_TONE[status] ?? STATUS_TONE.CLOSED)}>{titleCase(status)}</Badge>
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-[21px] leading-tight font-semibold tracking-tight">{title}</h1>{description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, body, children }: { icon: LucideIcon; title: string; body?: string; children?: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="grid size-10 place-items-center rounded-lg border bg-secondary text-primary"><Icon className="size-[18px]" aria-hidden="true" /></div>
      <h3 className="text-[13px] font-semibold">{title}</h3>
      {body && <p className="max-w-sm text-xs text-muted-foreground">{body}</p>}
      {children}
    </motion.div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert variant="destructive" className="mb-3">
      <TriangleAlert aria-hidden="true" />
      <AlertTitle>Couldn't load data</AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-3"><span>{message}</span>
        {onRetry && <Button size="xs" variant="outline" onClick={onRetry}><RotateCw data-icon="inline-start" />Retry</Button>}
      </AlertDescription>
    </Alert>
  )
}

export const Mono = ({ children, className }: { children: ReactNode; className?: string }) => <span className={cn('tech text-[11px]', className)}>{children}</span>
