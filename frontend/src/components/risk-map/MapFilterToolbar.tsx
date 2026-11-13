import { ALL_BANDS, type Filters } from './model'
import { BAND_META, type Band, type Nation } from '@/lib/countyRisk'
import { cn } from '@/lib/utils'

const NATIONS: { id: 'All' | Nation; label: string }[] = [{ id: 'All', label: 'All UK' }, { id: 'England', label: 'England' }, { id: 'Scotland', label: 'Scotland' }, { id: 'Wales', label: 'Wales' }, { id: 'Northern Ireland', label: 'N. Ireland' }]
const chip = 'h-7 rounded-[5px] border px-2.5 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#65B9EE]'

export function MapFilterToolbar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const toggle = (b: Band) => {
    const has = filters.bands.includes(b)
    if (has && filters.bands.length === 1) return // never filter everything out
    onChange({ ...filters, bands: ALL_BANDS.filter(x => (x === b ? !has : filters.bands.includes(x))) })
  }
  return (
    <div className="flex max-w-full flex-wrap items-center gap-1.5 rounded-[5px] border border-[#1B344D] bg-[#0B1E33]/95 p-1.5 shadow-lg backdrop-blur" role="toolbar" aria-label="Map filters">
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Nation">
        {NATIONS.map(n => (
          <button key={n.id} role="radio" aria-checked={filters.nation === n.id} onClick={() => onChange({ ...filters, nation: n.id })}
            className={cn(chip, filters.nation === n.id ? 'border-[#65B9EE] bg-[#65B9EE]/15 text-[#BFE8FF]' : 'border-transparent text-[#8CA2BA] hover:bg-[#12304A]')}>{n.label}</button>
        ))}
      </div>
      <span className="mx-0.5 hidden h-4 w-px bg-[#1B344D] sm:block" aria-hidden="true" />
      <div className="flex flex-wrap gap-1" role="group" aria-label="Risk band">
        {ALL_BANDS.map(b => {
          const on = filters.bands.includes(b), m = BAND_META[b]
          return (
            <button key={b} aria-pressed={on} onClick={() => toggle(b)} title={`${m.label} ${m.range}`}
              className={cn(chip, 'flex items-center gap-1.5', on ? 'border-[#1B344D] bg-[#071426] text-[#F2F7FC]' : 'border-transparent text-[#8CA2BA] opacity-60 hover:bg-[#12304A]')}>
              <span className="size-2 rounded-full" style={{ background: on ? m.color : 'transparent', boxShadow: `inset 0 0 0 1.5px ${m.color}` }} aria-hidden="true" />{m.label}<span className="tech text-[10px] opacity-70">{m.range}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
