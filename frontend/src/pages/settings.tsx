import { useState } from 'react'
import { toast } from 'sonner'
import { Landmark, Monitor, Moon, ShieldCheck, Sun } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '@/components/ui/item'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/app/common'
import { useTheme, type ThemeMode } from '@/hooks/use-theme'
import { api, isAdmin, set, signOut, useApp } from '@/store/app'

const PREFS_KEY = 'detection-monitor.notifications'
type Prefs = { highRisk: boolean; assigned: boolean }
const readPrefs = (): Prefs => { try { return { highRisk: true, assigned: true, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') } } catch { return { highRisk: true, assigned: true } } }

export default function Settings() {
  const app = useApp()
  const { user, demo, live, lastUpdated, settingsTab } = app
  const admin = isAdmin(app)
  const { mode, setMode } = useTheme()
  const [prefs, setPrefs] = useState<Prefs>(readPrefs)
  const [busy, setBusy] = useState(false)
  const savePref = (patch: Partial<Prefs>) => { const next = { ...prefs, ...patch }; setPrefs(next); try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)) } catch { /* ignore */ } toast.success('Preference saved') }
  async function connectBank() {
    setBusy(true)
    try { location.assign((await api().bankConnectUrl()).auth_url) } catch (e) { toast.error('Cannot start bank connection', { description: e instanceof Error ? e.message : undefined }); setBusy(false) }
  }
  return (
    <div>
      <PageHeader title="Settings" description="Theme, profile, notifications and integrations" />
      <Tabs value={settingsTab} onValueChange={v => set({ settingsTab: v })}>
        <TabsList className="mb-3"><TabsTrigger value="profile">Profile</TabsTrigger><TabsTrigger value="appearance">Appearance</TabsTrigger><TabsTrigger value="notifications">Notifications</TabsTrigger><TabsTrigger value="security">Security</TabsTrigger><TabsTrigger value="integrations">Integrations</TabsTrigger></TabsList>

        <TabsContent value="profile"><Card className="dash-card max-w-xl"><CardHeader><CardTitle className="text-[13px]">Profile</CardTitle><CardDescription>Your account on this workspace. Role permissions are enforced by the API.</CardDescription></CardHeader>
          <CardContent><FieldGroup className="gap-3">
            <Field><FieldLabel htmlFor="p-name">Name</FieldLabel><Input id="p-name" value={user?.display_name ?? ''} readOnly /></Field>
            <Field><FieldLabel htmlFor="p-mail">Email</FieldLabel><Input id="p-mail" value={user?.email ?? ''} readOnly className="tech" /></Field>
            <Field><FieldLabel>Role</FieldLabel><div><Badge variant="outline" className="capitalize">{user?.role}</Badge></div><FieldDescription>{admin ? 'Administrators can edit rules and connect integrations.' : 'Analysts can review and decide on alerts. Rule changes need an administrator.'}</FieldDescription></Field>
          </FieldGroup></CardContent></Card></TabsContent>

        <TabsContent value="appearance"><Card className="dash-card max-w-xl"><CardHeader><CardTitle className="text-[13px]">Theme</CardTitle><CardDescription>Dark is the default. System follows your operating-system setting.</CardDescription></CardHeader>
          <CardContent><RadioGroup value={mode} onValueChange={v => setMode(v as ThemeMode)} className="grid grid-cols-3 gap-2" aria-label="Theme">
            {([['dark', 'Dark', Moon], ['light', 'Light', Sun], ['system', 'System', Monitor]] as const).map(([v, l, Icon]) => (
              <Label key={v} htmlFor={`theme-${v}`} className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-3 text-xs font-normal transition-colors hover:bg-muted ${mode === v ? 'border-primary bg-primary/10' : ''}`}>
                <RadioGroupItem value={v} id={`theme-${v}`} className="sr-only" /><Icon className="size-5" aria-hidden="true" />{l}</Label>))}
          </RadioGroup></CardContent></Card></TabsContent>

        <TabsContent value="notifications"><Card className="dash-card max-w-xl"><CardHeader><CardTitle className="text-[13px]">Notifications</CardTitle><CardDescription>In-app preferences, stored in this browser.</CardDescription></CardHeader>
          <CardContent><ItemGroup>
            {([['highRisk', 'High-risk transactions', 'Toast when a new transaction scores 60 or more.'], ['assigned', 'Assignment changes', 'Toast when a case is assigned to you.']] as const).map(([k, t, d]) => (
              <Item key={k} variant="outline" className="mb-2"><ItemContent><ItemTitle>{t}</ItemTitle><ItemDescription>{d}</ItemDescription></ItemContent><ItemActions><Switch checked={prefs[k]} onCheckedChange={v => savePref({ [k]: v })} aria-label={t} /></ItemActions></Item>))}
          </ItemGroup></CardContent></Card></TabsContent>

        <TabsContent value="security"><Card className="dash-card max-w-xl"><CardHeader><CardTitle className="text-[13px]">Security</CardTitle><CardDescription>Session and access for this workspace.</CardDescription></CardHeader>
          <CardContent className="space-y-3 text-xs">
            <p className="text-muted-foreground">Signed in as <span className="tech text-foreground">{user?.email}</span> with the <span className="capitalize text-foreground">{user?.role}</span> role. Access tokens expire automatically and are revoked on sign-out.</p>
            <p className="text-muted-foreground">Sign-in and sign-out events are recorded in the tamper-evident audit history.</p>
            <Button variant="outline" onClick={() => void signOut()}>Sign out of this session</Button>
          </CardContent></Card></TabsContent>

        <TabsContent value="integrations"><div className="grid max-w-3xl gap-3">
          <Card className="dash-card"><CardHeader><CardTitle className="flex items-center gap-2 text-[13px]"><ShieldCheck className="size-4 text-primary" aria-hidden="true" />Backend connection</CardTitle><CardDescription>FastAPI, PostgreSQL and Redis wakeups.</CardDescription></CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2 text-xs"><Badge variant="outline" className="gap-1.5"><span className={`size-1.5 rounded-full ${live ? 'bg-ok' : 'bg-sev-med'}`} aria-hidden="true" />{demo ? 'Demo data (no backend)' : live ? 'Connected' : 'Unreachable'}</Badge>{lastUpdated && <span className="text-muted-foreground">Last sync <span className="tech">{lastUpdated.toLocaleTimeString('en-GB')}</span></span>}</CardContent></Card>
          <Card className="dash-card"><CardHeader><CardTitle className="flex items-center gap-2 text-[13px]"><Landmark className="size-4 text-primary" aria-hidden="true" />TrueLayer UK banking (sandbox)</CardTitle><CardDescription>Imports test accounts and transactions from the UK mock bank. Credentials stay on the server.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {demo ? <Alert><AlertTitle>Not available in demo mode</AlertTitle><AlertDescription>Sign in to a running backend to connect the sandbox.</AlertDescription></Alert>
                : !admin ? <Alert><AlertTitle>Administrator access required</AlertTitle><AlertDescription>Ask an administrator to connect the bank sandbox.</AlertDescription></Alert>
                : <Button onClick={connectBank} disabled={busy}><Landmark data-icon="inline-start" />Connect test bank</Button>}
              <p className="text-[11px] text-subtle">The client secret is read from the server environment and is never sent to the browser.</p>
            </CardContent></Card>
        </div></TabsContent>
      </Tabs>
    </div>
  )
}
