import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSet, FieldLegend } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { api, guarded } from '@/store/app'
import type { Rule, RuleKind } from '@/types'

const KINDS: [RuleKind, string][] = [['AMOUNT_THRESHOLD', 'Amount threshold'], ['COUNTRY_WATCHLIST', 'Country watchlist'], ['VELOCITY', 'Velocity (payment count)'], ['CUMULATIVE_AMOUNT', 'Cumulative outflow']]
const blank = { code: '', name: '', description: '', kind: 'AMOUNT_THRESHOLD' as RuleKind, weight: 40, enabled: true, minimum: '10000', countries: 'ZZ', window_minutes: 10, min_count: 3, minimum_total: '15000' }

/** Slider paired with a numeric input so thresholds can be dragged or typed precisely. */
function SliderField({ label, value, min, max, unit, onChange }: { label: string; value: number; min: number; max: number; unit?: string; onChange: (n: number) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3"><Label className="text-xs">{label}</Label>
        <div className="flex items-center gap-1.5"><Input type="number" min={min} max={max} value={value} aria-label={`${label} value`} className="h-7 w-20 text-right tech" onChange={e => { const n = Number(e.target.value); if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n))) }} />{unit && <span className="text-[11px] text-subtle">{unit}</span>}</div></div>
      <Slider value={[value]} min={min} max={max} step={1} onValueChange={v => onChange(v[0])} aria-label={label} />
    </div>
  )
}

export function RuleDialog({ rule, open, onOpenChange }: { rule: Rule | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [form, setForm] = useState(blank)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const editing = !!rule
  useEffect(() => {
    if (!open) return
    setError('')
    if (!rule) { setForm(blank); return }
    const c = rule.config as Record<string, unknown>
    setForm({ code: rule.code, name: rule.name, description: rule.description, kind: rule.kind, weight: rule.weight, enabled: rule.enabled, minimum: String(c.minimum ?? '10000'),
      countries: ((c.countries as string[]) ?? ['ZZ']).join(', '), window_minutes: Number(c.window_minutes ?? 10), min_count: Number(c.min_count ?? 3), minimum_total: String(c.minimum_total ?? '15000') })
  }, [open, rule])
  const set = <K extends keyof typeof blank>(k: K, v: (typeof blank)[K]) => setForm(f => ({ ...f, [k]: v }))
  const config = (): Record<string, unknown> => form.kind === 'AMOUNT_THRESHOLD' ? { minimum: form.minimum }
    : form.kind === 'COUNTRY_WATCHLIST' ? { countries: form.countries.split(/[\s,]+/).filter(Boolean).map(c => c.toUpperCase()) }
    : form.kind === 'VELOCITY' ? { window_minutes: form.window_minutes, min_count: form.min_count } : { window_minutes: form.window_minutes, minimum_total: form.minimum_total }
  const codeBad = !editing && !!form.code && !/^[A-Z][A-Z0-9_]{2,59}$/.test(form.code)
  const valid = form.name.trim().length >= 3 && (editing || /^[A-Z][A-Z0-9_]{2,59}$/.test(form.code))

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    const r = await guarded(async () => {
      try {
        return rule ? await api().updateRule(rule.id, { expected_version: rule.version, name: form.name.trim(), description: form.description, config: config(), weight: form.weight, enabled: form.enabled })
          : await api().createRule({ code: form.code, name: form.name.trim(), description: form.description, kind: form.kind, config: config(), weight: form.weight, enabled: form.enabled })
      } catch (err) { setError(err instanceof Error ? err.message : 'Save failed'); throw err }
    }, editing ? 'Rule updated' : 'Rule created')
    setBusy(false)
    if (r) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{editing ? `Edit ${rule?.code}` : 'Create risk rule'}</DialogTitle><DialogDescription>Changes are versioned and written to the audit log.</DialogDescription></DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <FieldGroup className="gap-3">
            {!editing && <div className="grid gap-3 sm:grid-cols-2">
              <Field data-invalid={codeBad}><FieldLabel htmlFor="rule-code">Rule code</FieldLabel><Input id="rule-code" value={form.code} maxLength={60} autoComplete="off" className="tech uppercase" aria-invalid={codeBad} onChange={e => set('code', e.target.value.toUpperCase())} />{codeBad ? <FieldError>3–60 chars: A–Z, 0–9, underscore; start with a letter.</FieldError> : <FieldDescription>e.g. HIGH_VALUE_WIRE</FieldDescription>}</Field>
              <Field><FieldLabel htmlFor="rule-kind">Rule type</FieldLabel><NativeSelect id="rule-kind" value={form.kind} onChange={e => set('kind', e.target.value as RuleKind)}>{KINDS.map(([v, l]) => <NativeSelectOption key={v} value={v}>{l}</NativeSelectOption>)}</NativeSelect></Field></div>}
            <Field><FieldLabel htmlFor="rule-name">Name</FieldLabel><Input id="rule-name" value={form.name} maxLength={120} autoComplete="off" onChange={e => set('name', e.target.value)} /></Field>
            <Field><FieldLabel htmlFor="rule-desc">Description</FieldLabel><Textarea id="rule-desc" rows={2} maxLength={1000} value={form.description} onChange={e => set('description', e.target.value)} /></Field>
            <FieldSet className="rounded-lg border p-3.5"><FieldLegend variant="label">Thresholds</FieldLegend>
              <FieldGroup className="gap-4">
                {form.kind === 'AMOUNT_THRESHOLD' && <Field><FieldLabel htmlFor="rule-min">Minimum amount (transaction currency)</FieldLabel><Input id="rule-min" type="number" min={1} step="any" className="tech" value={form.minimum} onChange={e => set('minimum', e.target.value)} /></Field>}
                {form.kind === 'COUNTRY_WATCHLIST' && <Field><FieldLabel htmlFor="rule-countries">Country codes</FieldLabel><Input id="rule-countries" className="tech uppercase" value={form.countries} onChange={e => set('countries', e.target.value)} /><FieldDescription>Two-letter codes, comma separated.</FieldDescription></Field>}
                {(form.kind === 'VELOCITY' || form.kind === 'CUMULATIVE_AMOUNT') && <SliderField label="Window" value={form.window_minutes} min={1} max={1440} unit="min" onChange={v => set('window_minutes', v)} />}
                {form.kind === 'VELOCITY' && <SliderField label="Minimum payment count" value={form.min_count} min={2} max={50} onChange={v => set('min_count', v)} />}
                {form.kind === 'CUMULATIVE_AMOUNT' && <Field><FieldLabel htmlFor="rule-total">Minimum cumulative total</FieldLabel><Input id="rule-total" type="number" min={1} step="any" className="tech" value={form.minimum_total} onChange={e => set('minimum_total', e.target.value)} /></Field>}
                <SliderField label="Risk weight (added to score)" value={form.weight} min={1} max={100} onChange={v => set('weight', v)} />
              </FieldGroup></FieldSet>
            <div className="flex items-center justify-between rounded-lg border px-3.5 py-2.5"><Label htmlFor="rule-enabled" className="text-xs">Enabled</Label><Switch id="rule-enabled" checked={form.enabled} onCheckedChange={v => set('enabled', v)} /></div>
          </FieldGroup>
          {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
          <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={busy || !valid}>{busy && <Spinner data-icon="inline-start" />}{editing ? 'Save changes' : 'Create rule'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
