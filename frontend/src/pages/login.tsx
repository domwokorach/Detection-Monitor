import { useState } from 'react'
import { motion } from 'motion/react'
import { Activity, Fingerprint, ShieldCheck, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { enterDemo, login } from '@/store/app'
import { ApiError } from '@/services/http'

export default function Login() {
  const [email, setEmail] = useState('admin@demo.local')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [offline, setOffline] = useState(false)
  const [busy, setBusy] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setOffline(false)
    try { await login(email, password) } catch (err) { setError(err instanceof Error ? err.message : 'Sign in failed'); setOffline(err instanceof ApiError && err.status === 0) } finally { setBusy(false) }
  }
  return (
    <main className="grid min-h-svh place-items-center p-4">
      <Card className="dash-card grid w-full max-w-4xl gap-0 overflow-hidden p-0 lg:grid-cols-2">
        <motion.section initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35 }} className="hidden flex-col justify-between bg-sidebar p-8 lg:flex">
          <div className="flex items-center gap-2.5"><div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground"><ShieldCheck className="size-5" aria-hidden="true" /></div><span className="text-base font-semibold">Detection-monitor</span></div>
          <div><h1 className="text-3xl leading-tight font-semibold tracking-tight">Catch fraud<br />before it settles.</h1><p className="mt-3 max-w-xs text-sm text-muted-foreground">Event-time rule screening, analyst case management and a tamper-evident audit trail for UK banking.</p>
            <div className="mt-5 flex gap-2 text-[11px] text-muted-foreground"><span className="flex items-center gap-1.5 rounded-full border px-2.5 py-1"><Activity className="size-3" aria-hidden="true" />Live screening</span><span className="flex items-center gap-1.5 rounded-full border px-2.5 py-1"><Fingerprint className="size-3" aria-hidden="true" />Audit-ready</span></div></div>
        </motion.section>
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }} className="p-8">
          <h2 className="text-lg font-semibold">Sign in</h2><p className="mt-1 text-xs text-muted-foreground">Use your analyst or administrator account.</p>
          <form onSubmit={submit} className="mt-5">
            <FieldGroup className="gap-3">
              <Field><FieldLabel htmlFor="email">Email</FieldLabel><Input id="email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></Field>
              <Field data-invalid={!!error}><FieldLabel htmlFor="password">Password</FieldLabel><Input id="password" type="password" autoComplete="current-password" required value={password} aria-invalid={!!error} onChange={e => setPassword(e.target.value)} />{error && <FieldError>{error}</FieldError>}</Field>
              <Button type="submit" disabled={busy}>{busy && <Spinner data-icon="inline-start" />}Sign in</Button>
            </FieldGroup>
          </form>
          <div className="my-5 flex items-center gap-3 text-[11px] text-subtle"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
          <Button variant="outline" className="w-full" onClick={() => enterDemo()}><Sparkles data-icon="inline-start" />Explore with demo data</Button>
          <FieldDescription className={`mt-2 text-center ${offline ? 'text-sev-med' : ''}`}>{offline ? 'The backend looks offline. You can still explore with simulated data.' : 'No backend needed. Demo data is simulated and clearly labelled.'}</FieldDescription>
        </motion.section>
      </Card>
    </main>
  )
}
