import { CalendarDays } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const fmt = (d?: Date) => d?.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) ?? ''
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
export const lastNDays = (n: number): DateRange => { const to = startOfDay(new Date()); return { from: new Date(to.getTime() - (n - 1) * 86_400_000), to } }

export function DateRangePicker({ value, onChange, presets = [7, 14] }: { value: DateRange | undefined; onChange: (r: DateRange | undefined) => void; presets?: number[] }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Select date range"><CalendarDays data-icon="inline-start" />{value?.from ? `${fmt(value.from)}${value.to ? ` – ${fmt(value.to)}` : ''}` : 'Date range'}</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <div className="flex gap-1 border-b p-2">{presets.map(n => <Button key={n} size="xs" variant="ghost" onClick={() => onChange(lastNDays(n))}>Last {n} days</Button>)}
          <Button size="xs" variant="ghost" onClick={() => onChange(undefined)}>Clear</Button></div>
        <Calendar mode="range" numberOfMonths={2} selected={value} onSelect={onChange} disabled={{ after: new Date() }} defaultMonth={value?.from} />
      </PopoverContent>
    </Popover>
  )
}
