import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { CheckCheck, ClipboardCheck, NotebookPen, Siren, UserCheck } from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Mono, RiskBadge, StatusBadge } from '@/components/app/common'
import { MerchantLogo } from '@/components/app/merchant-logo'
import { ALERT_RISK_META, alertRiskLevel } from '@/lib/risk'
import { money } from '@/lib/format'
import { londonTime, londonZone } from '@/lib/time'
import { api, guarded, useApp } from '@/store/app'
import type { AlertDetail, Investigation } from '@/types'

type Dlg = null | 'note' | 'escalate' | 'close'

export function Overview({ inv, detail, onChanged }: { inv: Investigation; detail: AlertDetail; onChanged: () => void }) {
  const { user } = useApp()
  const [dlg, setDlg] = useState<Dlg>(null)
  const [note, setNote] = useState('')
  const [disposition, setDisposition] = useState('')
  const [busy, setBusy] = useState(false)
  const [loss, setLoss] = useState('')
  const qc = useQueryClient()
  const tx = detail.transaction
  const closed = detail.status === 'CLOSED'
  const lockedOther = !!detail.assigned_to && detail.assigned_to !== user?.id && user?.role !== 'admin'
  const locked = closed || lockedOther
  const why = closed ? 'This case is closed and immutable.' : lockedOther ? 'Assigned to another analyst.' : ''
  const meta = ALERT_RISK_META[alertRiskLevel(detail.risk_score)]

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true)
    const r = await guarded(action, success)
    setBusy(false)
    if (r !== undefined) { setDlg(null); setNote(''); setDisposition(''); setLoss(''); onChanged(); void qc.invalidateQueries({ queryKey: ['investigations'] }) }
  }
  const lossOk = !loss.trim() || (/^\d+(\.\d{1,2})?$/.test(loss.trim()) && Number(loss) <= Number(tx.amount))
  const body = (status: AlertDetail['status']) => ({ status, assign_to_me: true, note: note.trim() || null })
  const lock = (el: React.ReactElement) => (locked ? <Tooltip><TooltipTrigger asChild><span>{el}</span></TooltipTrigger><TooltipContent>{why}</TooltipContent></Tooltip> : el)

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="dash-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <MerchantLogo domain={inv.merchant.domain} name={inv.merchant.name} size={40} />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-subtle"><Mono className="text-primary">{inv.case_ref}</Mono><span>Investigation</span></p>
            <h2 className="truncate text-lg leading-tight font-semibold tracking-tight">{inv.merchant.name}</h2>
            <p className="tech truncate text-[10.5px] text-subtle">{inv.merchant.domain ?? 'No verified domain'}</p>
          </div>
        </div>
        <div className="text-right"><p className="text-2xl font-semibold tracking-tight tnum">{money(tx.amount, tx.currency)}</p><p className="text-[11px] text-muted-foreground">{tx.direction === 'DEBIT' ? 'Outgoing payment' : 'Incoming payment'}</p></div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-3 text-xs sm:grid-cols-3 xl:grid-cols-6">
        <div><dt className="text-[10.5px] text-subtle">Customer / account</dt><dd className="mt-0.5 truncate">{inv.account.holder_name ?? inv.account.id}<span className="tech block text-[10.5px] text-subtle">{inv.account.account_number_masked}</span></dd></div>
        <div><dt className="text-[10.5px] text-subtle">Risk score</dt><dd className="mt-0.5 flex items-center gap-1.5"><RiskBadge score={detail.risk_score} bands="alert" /></dd></div>
        <div><dt className="text-[10.5px] text-subtle">Severity</dt><dd className="mt-0.5 font-medium" style={{ color: meta.color }}>{meta.label}</dd></div>
        <div><dt className="text-[10.5px] text-subtle">Status</dt><dd className="mt-0.5"><StatusBadge status={detail.status} /></dd></div>
        <div><dt className="text-[10.5px] text-subtle">Assigned analyst</dt><dd className="mt-0.5 truncate">{inv.assignee ? (inv.assignee.id === user?.id ? `${inv.assignee.display_name} (you)` : inv.assignee.display_name) : <span className="text-subtle italic">Unassigned</span>}</dd></div>
        <div><dt className="text-[10.5px] text-subtle">Opened</dt><dd className="tech mt-0.5 text-[11px]">{londonTime(inv.timestamps.opened)} {londonZone(inv.timestamps.opened)}</dd></div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2 border-t pt-3" role="group" aria-label="Investigation actions">
        {lock(<Button size="sm" variant="outline" disabled={locked || busy || detail.assigned_to === user?.id} onClick={() => void run(() => api().reviewAlert(detail.id, { status: detail.status === 'OPEN' ? 'IN_REVIEW' : detail.status, assign_to_me: true }), 'Assigned to you')}><UserCheck data-icon="inline-start" />Assign to me</Button>)}
        {lock(<Button size="sm" variant="outline" disabled={locked || busy} onClick={() => setDlg('note')}><NotebookPen data-icon="inline-start" />Add note</Button>)}
        {lock(<Button size="sm" variant="outline" disabled={locked || busy} onClick={() => void run(() => api().evidenceReviewed(detail.id), 'Evidence review recorded')}><ClipboardCheck data-icon="inline-start" />Mark evidence reviewed</Button>)}
        {lock(<Button size="sm" variant="destructive" disabled={locked || busy || detail.status === 'ESCALATED'} onClick={() => setDlg('escalate')}><Siren data-icon="inline-start" />Escalate</Button>)}
        {lock(<Button size="sm" disabled={locked || busy} onClick={() => setDlg('close')}><CheckCheck data-icon="inline-start" />Close investigation</Button>)}
      </div>

      <Dialog open={dlg === 'note'} onOpenChange={o => { if (!o) setDlg(null) }}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Add investigation note</DialogTitle><DialogDescription>Written to the audit log with your identity and a timestamp. Do not paste credentials or full card numbers.</DialogDescription></DialogHeader>
          <Label htmlFor="inv-note" className="sr-only">Note</Label><Textarea id="inv-note" rows={4} maxLength={3000} value={note} onChange={e => setNote(e.target.value)} placeholder="What did you find?" />
          <DialogFooter><Button variant="outline" onClick={() => setDlg(null)}>Cancel</Button><Button disabled={busy || note.trim().length < 3} onClick={() => void run(() => api().reviewAlert(detail.id, { status: detail.status, note: note.trim() }), 'Note added')}>Save note</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={dlg === 'close'} onOpenChange={o => { if (!o) setDlg(null) }}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Close investigation</DialogTitle><DialogDescription>Closed cases are immutable. The disposition and note are permanent in the audit log.</DialogDescription></DialogHeader>
          <RadioGroup value={disposition} onValueChange={setDisposition} aria-label="Disposition" className="flex flex-wrap gap-4">{[['SUSPICIOUS', 'Confirmed suspicious'], ['FALSE_POSITIVE', 'False positive']].map(([v, l]) => <div key={v} className="flex items-center gap-2"><RadioGroupItem value={v} id={`close-${v}`} /><Label htmlFor={`close-${v}`} className="text-xs font-normal">{l}</Label></div>)}</RadioGroup>
          {disposition === 'SUSPICIOUS' && tx.currency === 'GBP' && (
            <div className="space-y-1"><Label htmlFor="close-loss" className="text-xs">Confirmed loss in £ (optional, up to {money(tx.amount)})</Label>
              <Input id="close-loss" inputMode="decimal" placeholder="0.00" className="tech" value={loss} onChange={e => setLoss(e.target.value)} aria-invalid={!lossOk} />
              <p className="text-[10px] text-muted-foreground">Only record a loss that has been established. Leave blank if none is confirmed yet.</p></div>)}
          <Label htmlFor="close-note" className="text-xs">Closing note (at least 10 characters)</Label><Textarea id="close-note" rows={4} maxLength={3000} value={note} onChange={e => setNote(e.target.value)} />
          <DialogFooter><Button variant="outline" onClick={() => setDlg(null)}>Cancel</Button><Button disabled={busy || !disposition || note.trim().length < 10 || !lossOk} onClick={() => void run(() => api().reviewAlert(detail.id, { ...body('CLOSED'), disposition: disposition as 'SUSPICIOUS' | 'FALSE_POSITIVE', note: note.trim(), confirmed_loss: disposition === 'SUSPICIOUS' && loss.trim() ? Number(loss).toFixed(2) : null }), 'Investigation closed')}>Close investigation</Button></DialogFooter></DialogContent>
      </Dialog>

      <AlertDialog open={dlg === 'escalate'} onOpenChange={o => { if (!o) setDlg(null) }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Escalate this investigation?</AlertDialogTitle><AlertDialogDescription>The case is flagged for senior review and assigned to you. The action is written to the audit log.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => void run(() => api().reviewAlert(detail.id, body('ESCALATED')), 'Case escalated')}>Escalate</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}
