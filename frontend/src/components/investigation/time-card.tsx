import { Clock } from 'lucide-react'
import type { Investigation } from '@/types'
import { duration, londonTime, londonZone, utcTime } from '@/lib/time'
import { Section } from './shared'

/** Every stored timestamp is UTC; UK local time is derived with Europe/London (GMT/BST automatic). */
export function TimeCard({ t }: { t: Investigation['timestamps'] }) {
  const rows: [string, string | null][] = [
    ['Transaction timestamp', t.transaction], ['Received', t.received], ['Detection timestamp', t.detected], ['Investigation opened', t.opened],
    ['Last activity', t.last_activity], ['Last review', t.reviewed],
  ]
  return (
    <Section title="Date & Time Intelligence" subtitle="Stored in UTC · shown in UK local time (Europe/London)" aside={<span className="tech inline-flex items-center gap-1 text-[10.5px] text-subtle"><Clock className="size-3" aria-hidden="true" />{londonZone(t.detected)}</span>}>
      <dl className="divide-y">
        {rows.map(([label, iso]) => (
          <div key={label} className="flex items-baseline justify-between gap-3 py-1.5">
            <dt className="text-[11px] text-muted-foreground">{label}</dt>
            <dd className="text-right">{iso ? <><time dateTime={iso} className="tech block text-xs text-foreground">{londonTime(iso)} {londonZone(iso)}</time><span className="tech block text-[10px] text-subtle">{utcTime(iso)}</span></> : <span className="text-xs text-subtle italic">Not yet reviewed</span>}</dd>
          </div>))}
        <div className="flex items-baseline justify-between gap-3 py-1.5"><dt className="text-[11px] text-muted-foreground">Processing time <span className="text-subtle">(receipt → alert)</span></dt><dd className="tech text-xs">{duration(t.processing_seconds)}</dd></div>
      </dl>
    </Section>
  )
}
