import { motion } from 'motion/react'
import { Bell, CheckCheck, ClipboardCheck, Cpu, FolderOpen, Inbox, NotebookPen, Siren, UserCheck, type LucideIcon } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { TimelineItem } from '@/types'
import { londonTime, londonZone, utcTime } from '@/lib/time'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/app/common'
import { Section } from './shared'

const ICON: Record<TimelineItem['kind'], [LucideIcon, string]> = {
  received: [Inbox, 'text-primary'], rules: [Cpu, 'text-primary'], alert: [Bell, 'text-sev-high'], assigned: [UserCheck, 'text-hl'], opened: [FolderOpen, 'text-hl'],
  evidence: [ClipboardCheck, 'text-ok'], note: [NotebookPen, 'text-ice'], escalated: [Siren, 'text-sev-crit'], closed: [CheckCheck, 'text-ok'],
}

export function TimelineCard({ items }: { items: TimelineItem[] }) {
  return (
    <Section title="Investigation Timeline" subtitle="From the tamper-evident audit log, oldest first">
      {!items.length ? <EmptyState icon={Inbox} title="No history yet" /> : (
        <ol className="relative space-y-3 before:absolute before:top-2 before:bottom-2 before:left-[13px] before:w-px before:bg-border">
          {items.map((it, i) => { const [Icon, tone] = ICON[it.kind]; return (
            <motion.li key={`${it.kind}-${it.seq ?? i}-${it.at}`} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2, delay: Math.min(i, 10) * 0.03 }} className="relative flex gap-3">
              <span className={cn('z-10 grid size-[27px] shrink-0 place-items-center rounded-full border bg-card', tone)}><Icon className="size-3.5" aria-hidden="true" /></span>
              <div className="min-w-0 flex-1 pb-0.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="text-xs font-medium">{it.title}</p>
                  <time dateTime={it.at} className="tech text-[10.5px] text-muted-foreground" title={utcTime(it.at)}>{londonTime(it.at)} {londonZone(it.at)}</time>
                </div>
                {it.detail && <p className="mt-0.5 text-[11px] whitespace-pre-wrap text-muted-foreground">{it.detail}</p>}
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10.5px] text-subtle"><span>{it.actor}</span>
                  {it.entry_hash && <Tooltip><TooltipTrigger asChild><span className="tech cursor-help underline decoration-dotted underline-offset-2">audit #{it.seq} · {it.entry_hash.slice(0, 8)}</span></TooltipTrigger><TooltipContent className="tech max-w-72 break-all text-[10px]">{it.entry_hash}</TooltipContent></Tooltip>}</p>
              </div>
            </motion.li>) })}
        </ol>)}
    </Section>
  )
}
