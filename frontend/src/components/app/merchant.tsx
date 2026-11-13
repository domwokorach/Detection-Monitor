import { useEffect, useState } from 'react'
import { CheckmarkBadge01Icon, HelpCircleIcon, InformationCircleIcon, Search01Icon } from '@hugeicons/core-free-icons'
import { Icon } from './icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { api, guarded, useMerchantLookup } from '@/store/app'
import type { BrandCandidate } from '@/types'
import { sanitizeDomain } from '@/lib/logo'
import { dateTime } from '@/lib/format'
import { MerchantLogo } from './merchant-logo'

/** Logo + name (+ verified domain) for table cells. Logos appear only for analyst-verified domains. */
export function MerchantIdentity({ counterparty, size = 32, showDomain = false }: { counterparty: string; size?: number; showDomain?: boolean }) {
  const merchant = useMerchantLookup()(counterparty)
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <MerchantLogo domain={merchant?.domain} name={counterparty} size={size} />
      <span className="min-w-0">
        <span className="block truncate font-medium">{counterparty}</span>
        {showDomain && <span className="block truncate tech text-[10px] text-subtle">{merchant?.domain ?? 'No verified domain'}</span>}
      </span>
    </span>
  )
}

export const LOGO_DISCLAIMER = 'Logos are visual identifiers only. A logo is not evidence that a merchant is legitimate or fraudulent.'

/** Merchant card for drawers and the case workspace, with the verify/resolve flow. */
export function MerchantPanel({ counterparty }: { counterparty: string }) {
  const merchant = useMerchantLookup()(counterparty)
  const [resolving, setResolving] = useState(false)
  return (
    <div className="dash-card flex items-center gap-3 p-3">
      <MerchantLogo domain={merchant?.domain} name={counterparty} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[13px] font-semibold">{counterparty}</p>
          <Tooltip><TooltipTrigger asChild><button type="button" aria-label="About merchant logos" className="rounded text-subtle outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"><Icon icon={InformationCircleIcon} size={14} /></button></TooltipTrigger>
            <TooltipContent className="max-w-60">{LOGO_DISCLAIMER}</TooltipContent></Tooltip>
        </div>
        {merchant
          ? <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground"><span className="tech text-primary">{merchant.domain}</span>
            <Tooltip><TooltipTrigger asChild><Badge variant="outline" className="gap-1 border-ok/30 bg-ok/10 font-normal text-ok"><Icon icon={CheckmarkBadge01Icon} size={12} />Domain verified</Badge></TooltipTrigger>
              <TooltipContent>Confirmed by {merchant.verified_by} on {dateTime(merchant.created_at)}</TooltipContent></Tooltip></p>
          : <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground"><span>No verified domain</span><Badge variant="outline" className="gap-1 font-normal"><Icon icon={HelpCircleIcon} size={12} />Unresolved</Badge></p>}
      </div>
      {!merchant && <Button size="xs" variant="outline" onClick={() => setResolving(true)}><Icon icon={Search01Icon} size={12} />Resolve domain</Button>}
      {!merchant && <ResolveMerchantDialog counterparty={counterparty} open={resolving} onOpenChange={setResolving} />}
    </div>
  )
}

/**
 * Analyst-confirmed binding of a counterparty name to a domain. Logo.dev (via our API) only suggests
 * candidates; nothing is saved until the analyst picks one, and every save is written to the audit log.
 */
export function ResolveMerchantDialog({ counterparty, open, onOpenChange }: { counterparty: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [candidates, setCandidates] = useState<BrandCandidate[] | null>(null)
  const [error, setError] = useState('')
  const [choice, setChoice] = useState('')
  const [manual, setManual] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    let live = true
    setCandidates(null); setError(''); setChoice(''); setManual('')
    // Only the merchant name is sent upstream; never account numbers, amounts or other transaction detail.
    api().brandSearch(counterparty).then(r => { if (live) setCandidates(r.candidates) })
      .catch(e => { if (live) { setCandidates([]); setError(e instanceof Error ? e.message : 'Search failed') } })
    return () => { live = false }
  }, [open, counterparty])

  const domain = manual.trim() ? sanitizeDomain(manual) : choice || null
  async function save() {
    if (!domain) return
    setBusy(true)
    const saved = await guarded(() => api().verifyMerchant(counterparty, domain), 'Merchant domain verified')
    setBusy(false)
    if (saved) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resolve merchant domain</DialogTitle>
          <DialogDescription>Payment references can be ambiguous. Pick the website you have confirmed belongs to “{counterparty}”, or enter it yourself.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {candidates === null && <div className="space-y-2" aria-busy="true" aria-label="Searching brands"><Skeleton className="h-11" /><Skeleton className="h-11" /></div>}
          {error && <p role="alert" className="rounded-lg border border-sev-med/30 bg-sev-med/10 p-2 text-xs text-sev-med">{error}. You can still enter a domain manually.</p>}
          {candidates?.length === 0 && !error && <p className="text-xs text-muted-foreground">No suggestions found for this name.</p>}
          {!!candidates?.length && (
            <RadioGroup value={manual.trim() ? '' : choice} onValueChange={v => { setChoice(v); setManual('') }} aria-label="Suggested domains" className="gap-1.5">
              {candidates.map(c => (
                <Label key={c.domain} htmlFor={`cand-${c.domain}`} className="flex cursor-pointer items-center gap-3 rounded-lg border p-2 font-normal transition-colors hover:bg-muted/60 has-[[data-state=checked]]:border-primary/50 has-[[data-state=checked]]:bg-primary/10">
                  <RadioGroupItem value={c.domain} id={`cand-${c.domain}`} />
                  <MerchantLogo domain={c.domain} name={c.name} size={32} />
                  <span className="min-w-0"><span className="block truncate text-xs font-medium">{c.name}</span><span className="block truncate tech text-[10px] text-muted-foreground">{c.domain}</span></span>
                </Label>))}
            </RadioGroup>)}
          <div className="space-y-1.5">
            <Label htmlFor="manual-domain" className="text-xs">Or enter the domain</Label>
            <Input id="manual-domain" className="h-8 tech" placeholder="example.co.uk" value={manual} onChange={e => setManual(e.target.value)} aria-invalid={!!manual.trim() && !domain} autoComplete="off" spellCheck={false} />
            {!!manual.trim() && !domain && <p className="text-[11px] text-destructive">Enter a bare domain such as example.co.uk (no https:// or path).</p>}
          </div>
          <p className="text-[11px] text-subtle">{LOGO_DISCLAIMER}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!domain || busy} onClick={() => void save()}>Verify domain</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
