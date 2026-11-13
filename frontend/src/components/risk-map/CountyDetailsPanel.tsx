import { X, ExternalLink } from 'lucide-react'
import { AnimatedValue } from '@/components/app/animated-value'
import { BAND_META, bandOf, type Band, type CountyArea } from '@/lib/countyRisk'
import { money, relative } from '@/lib/format'
import { openAlert } from '@/store/app'
import { exposureLabel, type CountyAgg } from './model'

const lab = 'text-[10px] uppercase tracking-wide text-[#8CA2BA]'

export function CountyDetailsPanel({ county, agg, onClose, onArea }: { county: CountyArea; agg: CountyAgg | undefined; onClose: () => void; onArea: (code: string) => void }) {
  const total = agg?.alerts ?? 0
  return (
    <aside aria-label={`${county.name} risk details`} className="flex max-h-full w-[min(100%,20rem)] flex-col overflow-hidden rounded-[5px] border border-[#1B344D] bg-[#0B1E33]/97 text-[#F2F7FC] shadow-2xl backdrop-blur">
      <header className="flex items-start justify-between gap-2 border-b border-[#1B344D] px-3 py-2.5">
        <div className="min-w-0"><h2 className="truncate text-sm font-semibold">{county.name}</h2><p className="text-[11px] text-[#8CA2BA]">{county.nation} · <span className="tech">{county.code}</span></p></div>
        <button onClick={onClose} aria-label="Close details" className="grid size-6 shrink-0 place-items-center rounded-[5px] text-[#8CA2BA] outline-none hover:bg-[#12304A] focus-visible:ring-2 focus-visible:ring-[#65B9EE]"><X className="size-3.5" aria-hidden="true" /></button>
      </header>
      {!agg ? (
        <p className="px-3 py-5 text-xs text-[#8CA2BA]">No active alerts scoring 60 or above in this area under the current filters.</p>
      ) : (
        <div className="min-h-0 overflow-y-auto px-3 py-2.5">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            <div><dt className={lab}>High-risk transactions</dt><dd className="text-lg font-semibold"><AnimatedValue value={agg.transactions} format={n => String(Math.round(n))} /></dd></div>
            <div><dt className={lab}>Exposure</dt><dd className="text-lg font-semibold" title={exposureLabel(agg.exposure)}><AnimatedValue value={Math.round(agg.exposure.GBP ?? 0)} format={n => `£${Math.round(n).toLocaleString('en-GB')}`} /></dd></div>
            <div><dt className={lab}>Highest score</dt><dd className="text-sm font-medium"><span className="tech">{agg.maxScore}</span> · {BAND_META[bandOf(agg.maxScore)!].label}</dd></div>
            <div><dt className={lab}>Mean score</dt><dd className="tech text-sm font-medium">{agg.meanScore}</dd></div>
            <div className="col-span-2"><dt className={lab}>Latest alert</dt><dd className="text-sm">{relative(agg.lastUpdated)}</dd></div>
          </dl>
          <div className="mt-3" aria-label="Alerts by risk band">
            <div className="flex h-1.5 overflow-hidden rounded-full bg-[#071426]">
              {(['medium-high', 'high', 'critical'] as Band[]).map(b => agg.bands[b] > 0 && <span key={b} style={{ width: `${(agg.bands[b] / total) * 100}%`, background: BAND_META[b].color }} />)}
            </div>
            <ul className="mt-1.5 flex flex-wrap gap-x-3 text-[10px] text-[#8CA2BA]">
              {(['medium-high', 'high', 'critical'] as Band[]).map(b => <li key={b}><span style={{ color: BAND_META[b].color }} aria-hidden="true">●</span> {BAND_META[b].label} {agg.bands[b]}</li>)}
            </ul>
          </div>
          {agg.areas.length > 0 && (
            <section className="mt-3"><h3 className={lab}>Local authorities</h3>
              <ul className="mt-1 space-y-0.5">{agg.areas.map(a => (
                <li key={a.code}><button onClick={() => onArea(a.code)} className="flex w-full items-center justify-between rounded-[5px] px-1.5 py-1 text-left text-xs outline-none hover:bg-[#12304A] focus-visible:ring-2 focus-visible:ring-[#65B9EE]"><span className="truncate">{a.name}</span><span className="tech text-[#8CA2BA]">{a.alerts}</span></button></li>
              ))}</ul>
              <p className="mt-1 text-[10px] leading-snug text-[#8CA2BA]">Marker position is the local authority recorded on the account. It is not a street-level or IP-derived location.</p>
            </section>
          )}
          <section className="mt-3"><h3 className={lab}>Linked alerts</h3>
            <ul className="mt-1 space-y-1">{agg.events.slice(0, 8).map(e => (
              <li key={e.alert_id}><button onClick={() => openAlert(e.alert_id)} className="group flex w-full items-center justify-between gap-2 rounded-[5px] border border-[#1B344D] bg-[#071426] px-2 py-1.5 text-left outline-none hover:border-[#65B9EE] focus-visible:ring-2 focus-visible:ring-[#65B9EE]">
                <span className="min-w-0"><span className="block truncate text-xs">{e.counterparty}</span><span className="block text-[10px] text-[#8CA2BA]">{money(e.amount, e.currency)} · {relative(e.updated_at)}</span></span>
                <span className="flex shrink-0 items-center gap-1.5 text-xs" style={{ color: BAND_META[bandOf(e.risk_score)!].color }}><span className="tech">{e.risk_score}</span><ExternalLink className="size-3 opacity-60 group-hover:opacity-100" aria-label="Open investigation" /></span>
              </button></li>
            ))}</ul>
            {agg.events.length > 8 && <p className="mt-1 text-[10px] text-[#8CA2BA]">Showing the 8 highest of {agg.events.length}.</p>}
          </section>
        </div>
      )}
    </aside>
  )
}
