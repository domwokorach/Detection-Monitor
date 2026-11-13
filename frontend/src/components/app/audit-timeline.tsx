import { motion } from 'motion/react'
import type { Audit } from '@/types'
import { dateTime, relative, titleCase } from '@/lib/format'

const dot = (a: string) => (a.includes('RULE') ? 'bg-primary' : a.includes('ALERT') ? 'bg-sev-crit' : a.includes('LOGIN') ? 'bg-subtle' : 'bg-hl')
const changes = (e: Audit) => [...new Set([...Object.keys(e.before ?? {}), ...Object.keys(e.after ?? {})])]
  .map(k => ({ k, from: e.before?.[k], to: e.after?.[k] })).filter(c => JSON.stringify(c.from) !== JSON.stringify(c.to))
const show = (v: unknown) => (v === undefined || v === null ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v))

/** Vertical audit timeline. Timestamps and ids are monospace; changed fields show before → after. */
export function AuditTimeline({ events }: { events: Audit[] }) {
  return (
    <ol className="relative space-y-3 border-l pl-4">
      {events.map((e, i) => (
        <motion.li key={e.seq} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18, delay: Math.min(i, 10) * 0.02 }} className="relative">
          <span className={`absolute top-1.5 -left-[21px] size-2 rounded-full ring-4 ring-background ${dot(e.action)}`} aria-hidden="true" />
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <p className="text-xs font-medium">{titleCase(e.action)} <span className="font-normal text-subtle">· {titleCase(e.entity_type)}</span></p>
            <time className="tech text-[10px] text-subtle" dateTime={e.created_at} title={dateTime(e.created_at)}>{relative(e.created_at)}</time>
          </div>
          <p className="text-[11px] text-muted-foreground">{e.actor} · <span className="tech">{e.entity_id.slice(0, 8)}</span></p>
          {changes(e).length > 0 && (
            <dl className="mt-1.5 space-y-0.5 rounded-md border bg-secondary/40 p-2 text-[10.5px]">
              {changes(e).map(c => <div key={c.k} className="grid grid-cols-[6.5rem_1fr] gap-2"><dt className="text-subtle">{titleCase(c.k)}</dt>
                <dd className="tech break-all">{e.before && <><span className="text-sev-crit/80 line-through">{show(c.from)}</span> → </>}<span className="text-ok">{show(c.to)}</span></dd></div>)}
            </dl>
          )}
        </motion.li>
      ))}
    </ol>
  )
}
