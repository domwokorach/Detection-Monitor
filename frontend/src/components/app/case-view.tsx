import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { BellRing, CheckCheck, Clock3, FileSearch, NotebookPen, Play, ReceiptText, Siren, Sparkles, UserCheck } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Alert as UiAlert, AlertDescription } from '@/components/ui/alert'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { api, guarded, useApp } from '@/store/app'
import type { AlertDetail, AlertReview } from '@/types'
import { dateTime, money, relative, titleCase } from '@/lib/format'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { EmptyState, ErrorState, Mono, RiskBadge, StatusBadge } from './common'
import { MerchantPanel } from './merchant'
import { normalizeName } from '@/lib/merchant'
import { shortId } from '@/lib/dashboard'
import { openAlert } from '@/store/app'
import { AuditTimeline } from './audit-timeline'
import { Copilot } from './copilot'

type Pending = null | { kind: 'escalate' } | { kind: 'resolve' }

/** Full analyst review of one alert: evidence, history, copilot summary and the decision form. */
export function CaseView({ alertId }: { alertId: string }) {
  const { user, alerts, audit, accounts, transactions } = useApp()
  const [detail, setDetail] = useState<AlertDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [disposition, setDisposition] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<Pending>(null)
  const [tab, setTab] = useState('evidence')

  const load = async (silent = false) => {
    if (!silent) setLoading(true)
    try { setDetail(await api().alert(alertId)); setError('') } catch (e) { setError(e instanceof Error ? e.message : 'Could not load alert') } finally { setLoading(false) }
  }
  useEffect(() => { setNote(''); setDisposition(''); setTab('evidence'); void load() }, [alertId]) // eslint-disable-line react-hooks/exhaustive-deps
  const stamp = alerts.find(a => a.id === alertId)?.updated_at
  useEffect(() => { if (stamp) void load(true) }, [stamp]) // eslint-disable-line react-hooks/exhaustive-deps

  const locked = !!detail && (detail.status === 'CLOSED' || (!!detail.assigned_to && detail.assigned_to !== user?.id && user?.role !== 'admin'))
  const history = useMemo(() => (detail ? audit.filter(e => e.entity_id === detail.id || e.entity_id === detail.transaction_id) : []), [audit, detail])
  const account = accounts.find(a => a.id === detail?.transaction.account_id)
  const noteShort = note.trim().length < 10
  // Same counterparty name only (exact, normalised): related activity is never inferred from fuzzy matches.
  const sameMerchant = (name: string) => !!detail && normalizeName(name) === normalizeName(detail.transaction.counterparty)
  const relatedTxs = useMemo(() => transactions.filter(t => detail && t.id !== detail.transaction_id && sameMerchant(t.counterparty) && t.risk_score >= 40).slice(0, 10), [transactions, detail]) // eslint-disable-line react-hooks/exhaustive-deps
  const previousAlerts = useMemo(() => alerts.filter(a => detail && a.id !== detail.id && sameMerchant(a.transaction.counterparty)).sort((x, y) => +new Date(y.created_at) - +new Date(x.created_at)), [alerts, detail]) // eslint-disable-line react-hooks/exhaustive-deps
  const notes = useMemo(() => history.filter(e => e.action === 'ALERT_REVIEWED' && typeof e.after?.review_note === 'string' && e.after.review_note !== e.before?.review_note), [history])

  async function submit(body: AlertReview, success: string) {
    setBusy(true)
    const r = await guarded(() => api().reviewAlert(alertId, body), success)
    setBusy(false)
    if (r) { setNote(''); setDisposition(''); await load(true) }
  }

  if (loading) return <div className="space-y-3" aria-busy="true" aria-label="Loading case"><Skeleton className="h-24" /><Skeleton className="h-36" /><Skeleton className="h-28" /></div>
  if (error) return <ErrorState message={error} onRetry={() => load()} />
  if (!detail) return null
  const tx = detail.transaction

  return (
    <div className="space-y-4">
      <MerchantPanel counterparty={tx.counterparty} />
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="dash-card p-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] text-muted-foreground">{account?.holder_name ?? 'Account'} · <Mono>{account?.account_number_masked}</Mono></p>
            <p className="mt-1 text-2xl font-semibold tracking-tight tnum">{money(tx.amount, tx.currency)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{tx.direction === 'DEBIT' ? 'to' : 'from'} {tx.counterparty} · {tx.country}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5"><Tooltip><TooltipTrigger asChild><span><RiskBadge score={detail.risk_score} bands="alert" /></span></TooltipTrigger><TooltipContent className="max-w-56">Sum of the weights of matched rules (capped at 100). See Evidence for each match.</TooltipContent></Tooltip><StatusBadge status={detail.status} /></div>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 border-t pt-3 text-[11px]">
          <div><dt className="text-subtle">Occurred</dt><dd className="mt-0.5 tech">{dateTime(tx.occurred_at)}</dd></div>
          <div><dt className="text-subtle">Reference</dt><dd className="mt-0.5 truncate tech">{tx.external_id}</dd></div>
          <div><dt className="text-subtle">Assignee</dt><dd className="mt-0.5">{detail.assigned_to ? (detail.assigned_to === user?.id ? 'You' : 'Another analyst') : 'Unassigned'}</dd></div>
          <div><dt className="text-subtle">Disposition</dt><dd className="mt-0.5">{detail.disposition ? titleCase(detail.disposition) : '—'}</dd></div>
        </dl>
      </motion.div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto w-full flex-wrap">
          <TabsTrigger value="evidence"><FileSearch aria-hidden="true" />Evidence</TabsTrigger>
          <TabsTrigger value="related"><ReceiptText aria-hidden="true" />Related ({relatedTxs.length})</TabsTrigger>
          <TabsTrigger value="previous"><BellRing aria-hidden="true" />Previous alerts ({previousAlerts.length})</TabsTrigger>
          <TabsTrigger value="notes"><NotebookPen aria-hidden="true" />Notes ({notes.length})</TabsTrigger>
          <TabsTrigger value="timeline"><Clock3 aria-hidden="true" />Audit trail ({history.length})</TabsTrigger>
          <TabsTrigger value="copilot"><Sparkles aria-hidden="true" />Copilot</TabsTrigger>
        </TabsList>
        <TabsContent value="evidence" className="mt-3 space-y-2">
          {!detail.matches.length && <EmptyState icon={FileSearch} title="No rule evidence recorded" body="This transaction crossed the alert threshold without stored rule matches." />}
          {detail.matches.map((m, i) => (
            <motion.div key={m.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2, delay: i * 0.05 }} className="dash-card p-3">
              <div className="flex items-center justify-between gap-2"><Mono className="text-primary">{m.rule_code} <span className="text-subtle">v{m.rule_version}</span></Mono><span className="tech rounded bg-sev-crit/15 px-1.5 py-0.5 text-[11px] text-sev-crit">+{m.score}</span></div>
              <p className="mt-1.5 text-xs">{m.reason}</p>
              <p className="mt-1.5 truncate tech text-[10px] text-subtle">config: {JSON.stringify(m.rule_config_snapshot)}</p>
            </motion.div>
          ))}
        </TabsContent>
        <TabsContent value="related" className="mt-3">{relatedTxs.length
          ? <ul className="divide-y rounded-lg border">{relatedTxs.map(t => <li key={t.id} className="flex items-center justify-between gap-3 p-2.5 text-xs"><span><Mono>{t.external_id}</Mono><span className="block text-[10px] text-subtle">{relative(t.occurred_at)} · {t.country}</span></span><span className="flex items-center gap-2"><span className="tnum">{money(t.amount, t.currency)}</span><RiskBadge score={t.risk_score} showScore={false} bands="alert" /></span></li>)}</ul>
          : <EmptyState icon={ReceiptText} title="No related suspicious transactions" body="No other flagged transactions share this exact counterparty name." />}</TabsContent>
        <TabsContent value="previous" className="mt-3">{previousAlerts.length
          ? <ul className="divide-y rounded-lg border">{previousAlerts.map(a => <li key={a.id}><button className="flex w-full items-center justify-between gap-3 p-2.5 text-left text-xs outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50" onClick={() => openAlert(a.id)}><span><Mono>{shortId(a.id)}</Mono><span className="block text-[10px] text-subtle">{dateTime(a.created_at)}</span></span><span className="flex items-center gap-2"><RiskBadge score={a.risk_score} showScore={false} bands="alert" /><StatusBadge status={a.status} /></span></button></li>)}</ul>
          : <EmptyState icon={BellRing} title="No previous alerts" body="This counterparty has not been flagged before." />}</TabsContent>
        <TabsContent value="notes" className="mt-3 space-y-2">{notes.length
          ? notes.map(e => <div key={e.id} className="dash-card p-3"><p className="text-xs whitespace-pre-wrap">{String(e.after?.review_note)}</p><p className="mt-1.5 text-[10px] text-subtle">{e.actor} · {dateTime(e.created_at)}</p></div>)
          : <EmptyState icon={NotebookPen} title="No investigation notes" body="Notes you add when reviewing are kept here and in the audit log." />}</TabsContent>
        <TabsContent value="timeline" className="mt-3">{history.length ? <AuditTimeline events={history} /> : <EmptyState icon={Clock3} title="No history yet" />}</TabsContent>
        <TabsContent value="copilot" className="mt-3"><Copilot alert={detail} accountName={account?.holder_name} /></TabsContent>
      </Tabs>

      <form className="dash-card space-y-3 p-3.5" onSubmit={e => { e.preventDefault(); setPending({ kind: 'resolve' }) }} aria-label="Review decision">
        <h3 className="text-[13px] font-semibold">Review decision</h3>
        {locked ? (
          <UiAlert><AlertDescription>{detail.status === 'CLOSED' ? 'This case is closed and immutable.' : 'Assigned to another analyst.'}</AlertDescription></UiAlert>
        ) : (
          <FieldGroup className="gap-3">
            <Field data-invalid={pending?.kind === 'resolve' && noteShort}>
              <FieldLabel htmlFor="review-note">Review note</FieldLabel>
              <Textarea id="review-note" rows={3} maxLength={3000} value={note} onChange={e => setNote(e.target.value)} placeholder="What did you find? Written to the audit log." aria-invalid={pending?.kind === 'resolve' && noteShort} />
              <FieldDescription>At least 10 characters are required to resolve a case.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel>Disposition (required to resolve)</FieldLabel>
              <RadioGroup value={disposition} onValueChange={setDisposition} className="flex flex-wrap gap-4" aria-label="Disposition">
                {[['SUSPICIOUS', 'Confirmed suspicious'], ['FALSE_POSITIVE', 'False positive']].map(([v, l]) => (
                  <div key={v} className="flex items-center gap-2"><RadioGroupItem value={v} id={`disp-${v}`} /><Label htmlFor={`disp-${v}`} className="text-xs font-normal">{l}</Label></div>
                ))}
              </RadioGroup>
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" disabled={busy || detail.assigned_to === user?.id} onClick={() => submit({ status: detail.status, assign_to_me: true, note: note || null }, 'Assigned to you')}><UserCheck data-icon="inline-start" />Assign to me</Button>
              {detail.status === 'OPEN' && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => submit({ status: 'IN_REVIEW', assign_to_me: true, note: note || null }, 'Review started')}><Play data-icon="inline-start" />Start review</Button>}
              {detail.status !== 'ESCALATED' && <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => setPending({ kind: 'escalate' })}><Siren data-icon="inline-start" />Escalate</Button>}
              <Button type="submit" size="sm" disabled={busy || !disposition || noteShort}>{busy ? <Spinner data-icon="inline-start" /> : <CheckCheck data-icon="inline-start" />}Resolve case</Button>
            </div>
            {pending?.kind === 'resolve' && noteShort && <FieldError>Closing a case needs a note of at least 10 characters.</FieldError>}
          </FieldGroup>
        )}
      </form>

      <AlertDialog open={pending?.kind === 'escalate' || (pending?.kind === 'resolve' && !noteShort && !!disposition)} onOpenChange={o => { if (!o) setPending(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending?.kind === 'escalate' ? 'Escalate this case?' : 'Resolve and close this case?'}</AlertDialogTitle>
            <AlertDialogDescription>{pending?.kind === 'escalate' ? 'The case is flagged for senior review and the action is written to the audit log.' : 'Closed cases are immutable. The disposition and your note are permanent in the audit log.'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (pending?.kind === 'escalate') void submit({ status: 'ESCALATED', note: note || null, assign_to_me: true }, 'Case escalated')
              else void submit({ status: 'CLOSED', disposition: disposition as 'SUSPICIOUS' | 'FALSE_POSITIVE', note, assign_to_me: true }, 'Case resolved')
              setPending(null)
            }}>{pending?.kind === 'escalate' ? 'Escalate' : 'Resolve'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
