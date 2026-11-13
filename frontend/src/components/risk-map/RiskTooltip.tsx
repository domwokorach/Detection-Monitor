import { BAND_META, bandOf } from '@/lib/countyRisk'

export type Hover = { x: number; y: number; title: string; subtitle?: string; alerts?: number; maxScore?: number; note?: string }

export function RiskTooltip({ hover, width, height }: { hover: Hover | null; width: number; height: number }) {
  if (!hover) return null
  const band = hover.maxScore ? bandOf(hover.maxScore) : null
  const flip = hover.x > width - 230, below = hover.y < 110
  return (
    <div role="tooltip" className="pointer-events-none absolute z-20 w-52 rounded-[5px] border border-[#1B344D] bg-[#0B1E33] p-2 text-[11px] text-[#F2F7FC] shadow-xl"
      style={{ left: Math.min(Math.max(hover.x + (flip ? -218 : 14), 8), width - 216), top: Math.min(Math.max(below ? hover.y + 16 : hover.y - 12, 8), height - 100), transform: below ? undefined : 'translateY(-100%)' }}>
      <div className="font-medium">{hover.title}</div>
      {hover.subtitle && <div className="text-[#8CA2BA]">{hover.subtitle}</div>}
      {hover.alerts !== undefined && hover.alerts > 0 && band && (
        <div className="mt-1 flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: BAND_META[band].color }} aria-hidden="true" />{hover.alerts} alert{hover.alerts === 1 ? '' : 's'} · {BAND_META[band].label} · max <span className="tech">{hover.maxScore}</span></div>
      )}
      {hover.note && <div className="mt-1 text-[10px] leading-snug text-[#8CA2BA]">{hover.note}</div>}
    </div>
  )
}
