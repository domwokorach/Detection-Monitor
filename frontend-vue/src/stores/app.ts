import { computed, reactive, ref, shallowRef } from 'vue'
import { liveBackend, setAccessToken, ApiError } from '@/services/http'
import { demoBackend } from '@/services/demo'
import { notify } from './toast'
import type {
  Account, Alert, Audit, Backend, Daily, Overview, Page, Rule, RuleStat, Transaction, User,
} from '@/types'

const PAGES: Page[] = ['overview', 'transactions', 'alerts', 'rules', 'workspace', 'audit', 'customers', 'watchlists', 'cases', 'reports', 'settings']
const POLL_MS = 8000

const readHash = (): Page => {
  const raw = location.hash.replace('#/', '')
  const h = (raw === 'dashboard' ? 'overview' : raw) as Page
  return PAGES.includes(h) ? h : 'overview'
}

export const user = ref<User | null>(null)
export const demo = ref(false)
export const page = ref<Page>(readHash())
export const focusAlertId = ref<string | null>(null)
export const globalSearch = ref('')
/** Dashboard date range in days (the API serves 14 days of daily analytics). */
export const rangeDays = ref<7 | 14>(7)

export const data = reactive({
  overview: null as Overview | null,
  daily: [] as Daily[],
  accounts: [] as Account[],
  transactions: [] as Transaction[],
  alerts: [] as Alert[],
  rules: [] as Rule[],
  ruleStats: [] as RuleStat[],
  audit: [] as Audit[],
})
export const status = reactive({
  loading: false, loaded: false, error: '' as string, live: false, lastUpdated: null as Date | null,
})
export const notificationsSeenAt = ref(Date.now())

const backendRef = shallowRef<Backend>(liveBackend)
export const backend = (): Backend => backendRef.value
export const isAdmin = computed(() => user.value?.role === 'admin')

window.addEventListener('hashchange', () => { page.value = readHash() })
export function navigate(next: Page) {
  page.value = next
  if (location.hash !== `#/${next}`) history.replaceState(null, '', `#/${next}`)
}

let timer: number | undefined
let knownTx = new Set<string>()

export async function refresh(opts: { silent?: boolean } = {}) {
  if (!user.value) return
  if (!opts.silent) status.loading = true
  const b = backendRef.value
  try {
    const [overview, daily, alerts, transactions, rules, ruleStats, accounts, audit] = await Promise.all([
      b.overview(), b.daily(14), b.alerts(), b.transactions(500), b.rules(), b.ruleStats(), b.accounts(), b.audit(500),
    ])
    const fresh = transactions.filter(t => !knownTx.has(t.id))
    if (status.loaded && fresh.length) {
      const risky = fresh.filter(t => t.risk_score >= 60 || Number(t.amount) >= 10000)
      if (risky.length) notify('warning', `${risky.length} new high-risk transaction${risky.length > 1 ? 's' : ''}`, `${risky[0].counterparty} · ${risky[0].amount} ${risky[0].currency}`)
    }
    knownTx = new Set(transactions.map(t => t.id))
    Object.assign(data, { overview, daily, alerts, transactions, rules, ruleStats, accounts, audit })
    status.error = ''
    status.live = true
    status.lastUpdated = new Date()
    status.loaded = true
  } catch (e) {
    status.live = false
    if (e instanceof ApiError && e.status === 401) { logout(); notify('info', 'Session expired', 'Please sign in again.'); return }
    status.error = e instanceof Error ? e.message : 'Failed to load data'
  } finally {
    status.loading = false
  }
}

function startPolling() {
  stopPolling()
  timer = window.setInterval(() => { if (!document.hidden) void refresh({ silent: true }) }, POLL_MS)
}
function stopPolling() { if (timer) window.clearInterval(timer); timer = undefined }

async function begin(session: { access_token: string; user: User }, isDemo: boolean) {
  demo.value = isDemo
  backendRef.value = isDemo ? demoBackend : liveBackend
  setAccessToken(isDemo ? null : session.access_token)
  user.value = session.user
  try { sessionStorage.setItem('detection-monitor.session', JSON.stringify({ ...session, demo: isDemo })) } catch { /* storage unavailable */ }
  status.loaded = false
  knownTx = new Set()
  notificationsSeenAt.value = Date.now()
  await refresh()
  startPolling()
  await finishBankImport()
}

export async function login(email: string, password: string) {
  const session = await liveBackend.login(email, password)
  await begin(session, false)
}

export async function enterDemo(email = 'admin@demo.local') {
  await begin(await demoBackend.login(email, ''), true)
}

/** User-initiated sign-out: revoke the token server-side (best effort), then clear local session state. */
export async function signOut() {
  try { await backend().logout() } catch { /* token already invalid or API unreachable: still clear locally */ }
  logout()
}

export function logout() {
  stopPolling()
  setAccessToken(null)
  user.value = null
  demo.value = false
  status.loaded = false
  try { sessionStorage.removeItem('detection-monitor.session') } catch { /* ignore */ }
}

export async function restoreSession() {
  try {
    const raw = sessionStorage.getItem('detection-monitor.session')
    if (!raw) return
    const s = JSON.parse(raw)
    if (s.demo) { await enterDemo(s.user.email); return }
    await begin(s, false)
  } catch { logout() }
}

// ---- Mutations: each one refreshes shared state so every page stays consistent ----

export async function guarded<T>(action: () => Promise<T>, success?: string): Promise<T | undefined> {
  try {
    const result = await action()
    if (success) notify('success', success)
    await refresh({ silent: true })
    return result
  } catch (e) {
    notify('error', 'Action failed', e instanceof Error ? e.message : 'Unknown error')
    return undefined
  }
}

export function openAlert(id: string) {
  focusAlertId.value = id
  navigate('workspace')
}

// ---- TrueLayer sandbox: redirect out to the mock bank, import when the browser returns ----

const PENDING_KEY = 'detection-monitor.truelayer'

/** Call once at startup: lifts ?code&state off the callback URL so the code never lingers in history. */
export function captureBankCallback() {
  if (location.pathname !== '/truelayer/callback') return
  const q = new URLSearchParams(location.search)
  const code = q.get('code'), state = q.get('state')
  try {
    if (code && state) sessionStorage.setItem(PENDING_KEY, JSON.stringify({ code, state }))
    else if (q.get('error')) notify('error', 'Bank connection cancelled', q.get('error_description') ?? q.get('error') ?? undefined)
  } catch { /* storage unavailable */ }
  history.replaceState(null, '', '/#/transactions')
  page.value = 'transactions'
}

export async function connectBank() {
  try {
    const { auth_url } = await backendRef.value.bankConnectUrl()
    location.assign(auth_url)
  } catch (e) {
    notify('error', 'Cannot start bank connection', e instanceof Error ? e.message : undefined)
  }
}

async function finishBankImport() {
  let pending: { code: string; state: string } | null = null
  try { pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? 'null'); sessionStorage.removeItem(PENDING_KEY) } catch { /* ignore */ }
  if (!pending || demo.value) return
  const result = await guarded(() => backendRef.value.bankImport(pending!.code, pending!.state))
  if (result) notify('success', 'Bank connected (sandbox)', `${result.imported} imported, ${result.skipped} skipped across ${result.accounts} account(s). Screening runs in the background.`, 8000)
}
