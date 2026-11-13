/** Timestamps are stored in UTC; analysts read UK local time (Europe/London, GMT/BST handled by Intl). */
const london = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
const zone = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', timeZoneName: 'short' })

/** "13 Nov 2026, 12:34:56" in UK local time. */
export const londonTime = (iso: string) => london.format(new Date(iso))
/** "13 Nov 2026, 14:02 GMT": UK local time with the zone abbreviation (GMT in winter, BST in summer). */
const londonShortFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'short' })
export const londonShort = (iso: string) => londonShortFmt.format(new Date(iso)).replace(/(\d{4}) /, '$1, ')
/** "GMT" or "BST" for the given instant. */
export const londonZone = (iso: string) => zone.formatToParts(new Date(iso)).find(p => p.type === 'timeZoneName')?.value ?? 'UK'
export const utcTime = (iso: string) => new Date(iso).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')

export function duration(seconds: number | null): string {
  if (seconds == null) return '—'
  if (seconds < 1) return '<1 s'
  if (seconds < 60) return `${seconds.toFixed(1)} s`
  const m = Math.floor(seconds / 60), s = Math.round(seconds % 60)
  if (m < 60) return `${m} min ${s} s`
  return `${Math.floor(m / 60)} h ${m % 60} min`
}
