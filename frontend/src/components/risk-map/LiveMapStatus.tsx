import { AnimatedValue } from '@/components/app/animated-value'
import { relative } from '@/lib/format'
import { cn } from '@/lib/utils'
import { exposureLabel, type Totals } from './model'
import type { Feed } from './use-risk-map-data'

const stat = 'min-w-0'
const lab = 'text-[10px] uppercase tracking-wide text-[#8CA2BA]'

export function LiveMapStatus({ feed, totals, unlocated, threshold }: { feed: Feed; totals: Totals; unlocated: number; threshold: number }) {
  const live = feed.status === 'live', failed = feed.status === 'error'
  const gbp = Math.round(totals.exposure.GBP ?? 0)
  const nonGbp = Object.keys(totals.exposure).some(k => k !== 'GBP')
  return (
    <div className="w-[min(100%,21rem)] rounded-[5px] border border-[#1B344D] bg-[#0B1E33]/95 p-2.5 text-[#F2F7FC] shadow-lg backdrop-blur" aria-live="polite">
      <div className="mb-2 flex items-center justify-between gap-2 text-[11px]">
        <span className="flex items-center gap-1.5"><span className={cn('size-1.5 rounded-full', live ? 'bg-emerald-400' : failed ? 'bg-[#E85D68]' : 'bg-amber-400 animate-pulse')} aria-hidden="true" />{live ? 'Live' : failed ? 'Connection lost' : 'Connecting'}</span>
        <span className="tech text-[10px] text-[#8CA2BA]">{feed.lastSync ? `Synced ${feed.lastSync.toLocaleTimeString('en-GB')}` : 'Not yet synced'}</span>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
        <div className={stat}><dt className={lab}>Alerts {threshold}+</dt><dd className="text-base font-semibold"><AnimatedValue value={totals.alerts} format={n => Math.round(n).toLocaleString('en-GB')} /></dd></div>
        <div className={stat}><dt className={lab}>Highest score</dt><dd className="text-base font-semibold">{totals.alerts ? <AnimatedValue value={totals.maxScore} format={n => String(Math.round(n))} /> : '—'}</dd></div>
        <div className={stat} title={exposureLabel(totals.exposure)}><dt className={lab}>Suspicious exposure</dt><dd className="truncate text-base font-semibold"><AnimatedValue value={gbp} format={n => `£${Math.round(n).toLocaleString('en-GB')}`} />{nonGbp && <span className="text-[10px] font-normal text-[#8CA2BA]"> +other</span>}</dd></div>
        <div className={stat}><dt className={lab}>Latest alert</dt><dd className="truncate text-sm font-medium">{totals.lastUpdated ? relative(totals.lastUpdated) : '—'}</dd></div>
      </dl>
      {unlocated > 0 && <p className="mt-2 border-t border-[#1B344D] pt-1.5 text-[10px] text-[#8CA2BA]">{unlocated} alert{unlocated === 1 ? '' : 's'} not plotted: the account has no recorded local authority.</p>}
    </div>
  )
}
