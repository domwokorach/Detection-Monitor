import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import type { Alert, AlertStatus } from '@/types'

const STAGES: { key: AlertStatus; label: string; color: string }[] = [
  { key: 'OPEN', label: 'Awaiting triage', color: '#65B9EE' },
  { key: 'IN_REVIEW', label: 'In review', color: '#8DD4FA' },
  { key: 'ESCALATED', label: 'Escalated', color: '#E85D68' },
  { key: 'CLOSED', label: 'Closed', color: '#4F6E8C' },
]
const cfg = { n: { label: 'Cases' } } satisfies ChartConfig

/** Investigation pipeline: case count per workflow stage. */
export function StatusChart({ alerts }: { alerts: Alert[] }) {
  const data = STAGES.map(s => ({ ...s, n: alerts.filter(a => a.status === s.key).length }))
  return (
    <ChartContainer config={cfg} className="aspect-auto h-[170px] w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 28, top: 4, bottom: 4 }} barCategoryGap={8}>
        <XAxis type="number" hide /><YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={96} fontSize={10.5} />
        <ChartTooltip cursor={{ fill: 'var(--muted)', opacity: 0.4 }} content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="n" radius={[0, 4, 4, 0]} animationDuration={700}>
          {data.map(d => <Cell key={d.key} fill={d.color} />)}<LabelList dataKey="n" position="right" fontSize={10.5} className="fill-foreground tnum" />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
