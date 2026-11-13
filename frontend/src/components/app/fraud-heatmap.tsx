import { useMemo } from 'react'
import { motion } from 'motion/react'
import { interpolateRgb } from 'd3'
import type { Alert, Rule } from '@/types'
import { dayKey, lastDays } from '@/lib/dashboard'
import { titleCase } from '@/lib/format'

const label = (k: string) => new Date(`${k}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })
const ramp = interpolateRgb('#0B1E33', '#65B9EE')

/** Fraud-pattern heatmap: matched rule (pattern) by calendar day, shaded by alert count. */
export function FraudHeatmap({ alerts, rules, days = 7 }: { alerts: Alert[]; rules: Rule[]; days?: number }) {
  const keys = useMemo(() => lastDays(days), [days])
  const { rows, max } = useMemo(() => {
    const grid = new Map<string, number[]>()
    for (const a of alerts) {
      const i = keys.indexOf(dayKey(a.created_at))
      if (i < 0) continue
      for (const c of a.rule_codes ?? []) { const r = grid.get(c) ?? keys.map(() => 0); r[i]++; grid.set(c, r) }
    }
    const rows = [...grid.entries()].map(([code, cells]) => ({ code, cells, total: cells.reduce((s, n) => s + n, 0) })).sort((a, b) => b.total - a.total)
    return { rows, max: Math.max(1, ...rows.flatMap(r => r.cells)) }
  }, [alerts, keys])
  const name = (code: string) => rules.find(r => r.code === code)?.name ?? titleCase(code)

  if (!rows.length) return <p className="py-10 text-center text-[11px] text-subtle">No rule matches in the last {days} days</p>
  return (
    <div role="table" aria-label="Fraud pattern heatmap: alerts by rule and day" className="text-[10px]">
      <div role="row" className="grid items-end gap-1 pb-1.5" style={{ gridTemplateColumns: `minmax(0,1.3fr) repeat(${keys.length}, minmax(0,1fr))` }}>
        <span role="columnheader" className="text-subtle">Pattern</span>
        {keys.map(k => <span role="columnheader" key={k} className="truncate text-center text-subtle tnum">{label(k)}</span>)}
      </div>
      {rows.map((r, ri) => (
        <div role="row" key={r.code} className="mb-1 grid items-center gap-1" style={{ gridTemplateColumns: `minmax(0,1.3fr) repeat(${keys.length}, minmax(0,1fr))` }}>
          <span role="rowheader" className="truncate text-muted-foreground" title={name(r.code)}>{name(r.code)}</span>
          {r.cells.map((n, ci) => (
            <motion.span role="cell" key={ci} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25, delay: 0.2 + (ri * keys.length + ci) * 0.012 }}
              title={`${name(r.code)} · ${label(keys[ci])}: ${n} alert${n === 1 ? '' : 's'}`} aria-label={`${n} alerts`}
              className="grid h-7 place-items-center rounded-[5px] border border-border/60 tnum" style={{ background: n ? ramp(0.15 + 0.85 * (n / max)) : 'transparent', color: n / max > 0.55 ? '#020D1B' : 'var(--muted-foreground)' }}>{n || ''}</motion.span>
          ))}
        </div>
      ))}
      <div className="mt-2 flex items-center justify-end gap-1.5 text-subtle"><span>Fewer</span><span className="h-1.5 w-20 rounded-full" style={{ background: 'linear-gradient(90deg,#0B1E33,#65B9EE)' }} aria-hidden="true" /><span>More</span></div>
    </div>
  )
}
