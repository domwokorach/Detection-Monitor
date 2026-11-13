import { Check, Copy, ShieldQuestion } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { IpIntel } from '@/types'
import { londonTime, londonZone } from '@/lib/time'
import { cn } from '@/lib/utils'
import { Field, MaskedBadge, Provenance, Section } from './shared'

const REP = { clean: 'text-ok', suspicious: 'text-sev-high', malicious: 'text-sev-crit' } as const
const CONF = { low: 'Low confidence', medium: 'Medium confidence', high: 'High confidence' } as const

export function IpCard({ ip }: { ip: IpIntel | null }) {
  const [copied, setCopied] = useState(false)
  if (!ip) return (
    <Section title="IP Address Intelligence">
      <div role="status" className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center">
        <ShieldQuestion className="size-5 text-subtle" aria-hidden="true" />
        <p className="text-xs font-medium">No IP telemetry for this transaction</p>
        <p className="max-w-xs text-[11px] text-subtle">The payment channel did not supply a source IP (for example, open-banking imports carry none). Nothing is estimated in its place.</p>
      </div>
    </Section>
  )
  const g = ip.geo
  const place = [g.city, g.county, g.region].filter(Boolean).join(', ')
  const copy = async () => {
    try { await navigator.clipboard.writeText(ip.address); setCopied(true); toast.success('IP address copied'); setTimeout(() => setCopied(false), 1500) }
    catch { toast.error('Could not copy') }
  }
  return (
    <Section title="IP Address Intelligence" subtitle="Telemetry captured with the payment, plus provider estimates" aside={ip.masked ? <MaskedBadge what="The source IP" /> : undefined}>
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-secondary/50 p-2.5">
        <div className="min-w-0"><p className="text-[10.5px] text-subtle">Source IP · IPv{ip.version}</p><p className="tech truncate text-base font-semibold text-ice" aria-label={`Source IP address ${ip.address}`}>{ip.address}</p></div>
        <Tooltip><TooltipTrigger asChild><span><Button size="sm" variant="outline" disabled={ip.masked} onClick={() => void copy()}>{copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}Copy IP address</Button></span></TooltipTrigger>
          {ip.masked && <TooltipContent>Copying is limited to administrators</TooltipContent>}</Tooltip>
      </div>

      <div className="mt-3 flex items-center gap-2"><Provenance kind="observed" /><span className="text-[10.5px] text-subtle">{ip.telemetry.source}</span></div>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
        <Field label="First seen" value={<span className="tech">{londonTime(ip.first_seen)} {londonZone(ip.first_seen)}</span>} />
        <Field label="Last seen" value={<span className="tech">{londonTime(ip.last_seen)} {londonZone(ip.last_seen)}</span>} />
        <Field label="Accounts using this IP" value={<span className="tnum">{ip.accounts_sharing}</span>} />
        <Field label="Related transactions" value={<span className="tnum">{ip.related_transactions}</span>} />
        <Field label="Related alerts" value={<span className="tnum">{ip.related_alerts}</span>} />
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3"><Provenance kind="estimated" />
        <span className="text-[10.5px] text-subtle">{g.provider ? `Source: ${g.provider}` : 'No provider recorded'}{g.confidence && ` · ${CONF[g.confidence]}`}{g.accuracy_km != null && ` · ±${g.accuracy_km} km`}</span></div>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
        <Field label="Estimated country" value={g.country} />
        <Field label="Estimated city / region" value={place} />
        <Field label="ISP / network" value={ip.network.isp} />
        <Field label="ASN" value={ip.network.asn} mono />
        <Field label="VPN / proxy" value={ip.vpn_proxy === null ? null : ip.vpn_proxy ? <Badge variant="outline" className="border-sev-high/30 bg-sev-high/10 text-sev-high">Detected</Badge> : 'Not detected'} />
        <Field label="IP reputation" value={ip.reputation ? <span className={cn('font-medium capitalize', REP[ip.reputation])}>{ip.reputation}</span> : null} />
      </dl>
    </Section>
  )
}
