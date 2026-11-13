import type { LucideIcon } from 'lucide-react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { motion } from 'motion/react'
import { Line, LineChart, YAxis } from 'recharts'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { Card } from '@/components/ui/card'
import { CountUp } from './common'
import { cn } from '@/lib/utils'

export type Kpi = {
  label: string; value: number; decimals?: number; suffix?: string; icon: LucideIcon; color: string
  change: number | null; spark: number[]; goodWhenDown?: boolean; onOpen?: () => void
}

/** Compact KPI statistic card: animated value, period change (null when no baseline) and a sparkline. */
export function KpiCard({ kpi, compare, index }: { kpi: Kpi; compare: string; index: number }) {
  const { label, value, decimals, suffix, icon: Icon, color, change, spark, goodWhenDown, onOpen } = kpi
  const good = change !== null && (change >= 0) !== !!goodWhenDown
  const config = { v: { label, color } } satisfies ChartConfig
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.06, ease: 'easeOut' }}>
      <Card role="button" tabIndex={0} aria-label={`${label}: ${value}. Open details`} onClick={onOpen} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.() } }}
        className="dash-card cursor-pointer gap-0 rounded-[10px] p-3.5 ring-0 outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-md border bg-secondary" style={{ color }}><Icon className="size-[13px]" strokeWidth={1.75} aria-hidden="true" /></span>
          <span className="truncate text-[11px] font-medium text-muted-foreground">{label}</span>
        </div>
        <div className="mt-2.5 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[26px] leading-none font-semibold tracking-tight"><CountUp value={value} decimals={decimals} suffix={suffix} /></p>
            <p className="mt-2 flex items-center gap-1 text-[10px] text-subtle tnum">
              {change !== null ? (<>
                {change >= 0 ? <ArrowUpRight className={cn('size-[11px]', good ? 'text-ok' : 'text-sev-crit')} aria-hidden="true" /> : <ArrowDownRight className={cn('size-[11px]', good ? 'text-ok' : 'text-sev-crit')} aria-hidden="true" />}
                <span className={good ? 'text-ok' : 'text-sev-crit'}>{Math.abs(change).toFixed(1)}%</span> {compare}
              </>) : 'No prior-period baseline'}
            </p>
          </div>
          <ChartContainer config={config} className="aspect-auto h-8 w-20 shrink-0">
            <LineChart data={spark.map(v => ({ v }))} margin={{ top: 3, right: 2, bottom: 3, left: 2 }}>
              <YAxis hide domain={['dataMin', 'dataMax']} />
              <Line type="monotone" dataKey="v" stroke="var(--color-v)" strokeWidth={1.5} dot={false} isAnimationActive />
            </LineChart>
          </ChartContainer>
        </div>
      </Card>
    </motion.div>
  )
}
