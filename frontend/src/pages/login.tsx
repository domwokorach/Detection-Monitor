import { useState } from 'react'
import { motion } from 'motion/react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AuthHeroPanel } from '@/components/auth/AuthHeroPanel'
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
    <main className="grid min-h-svh grid-cols-1 lg:grid-cols-[55fr_45fr] [&>*]:min-w-0">
      <AuthHeroPanel />
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }} className="mx-auto flex w-full max-w-md flex-col justify-center p-6 sm:p-10 lg:p-12">
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
    </main>
  )
}
