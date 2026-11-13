/**
 * Global app state. A tiny external store (no extra dependency) read with useSyncExternalStore.
 * Mirrors what the FastAPI backend returns; mutations always refresh so every page stays consistent.
 */
import { useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { ApiError, liveBackend, setAccessToken } from '@/services/http'
import { demoBackend } from '@/services/demo'
import type { Account, Alert, Audit, Backend, Daily, Merchant, Overview, Page, Rule, RuleStat, Transaction, User } from '@/types'
import { normalizeName } from '@/lib/merchant'

const PAGES: Page[] = ['command', 'transactions', 'map', 'alerts', 'rules', 'investigations', 'cases', 'watchlist', 'audit', 'reports', 'inequality', 'settings', 'terms', 'privacy', 'security', 'accessibility']
const POLL_MS = 8000
const SESSION_KEY = 'sentinel.session'

export type State = {
  user: User | null
  demo: boolean
  page: Page
  focusAlertId: string | null
  search: string
  settingsTab: string
  loading: boolean
  loaded: boolean
  error: string
  live: boolean
  lastUpdated: Date | null
  overview: Overview | null
  daily: Daily[]
  accounts: Account[]
  transactions: Transaction[]
  alerts: Alert[]
  rules: Rule[]
  ruleStats: RuleStat[]
  audit: Audit[]
  merchants: Merchant[]
}

const readHash = (): Page => {
  const raw = location.hash.replace('#/', '')
  const h = (raw === 'dashboard' ? 'command' : raw) as Page
  return PAGES.includes(h) ? h : 'command'
}

let state: State = {
  user: null, demo: false, page: readHash(), focusAlertId: null, search: '', settingsTab: 'profile', loading: false, loaded: false, error: '', live: false,
  lastUpdated: null, overview: null, daily: [], accounts: [], transactions: [], alerts: [], rules: [], ruleStats: [], audit: [], merchants: [],
}
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())
export function set(patch: Partial<State>) { state = { ...state, ...patch }; emit() }
export const getState = () => state
export function useApp(): State { return useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb) }, getState) }

let backend: Backend = liveBackend
export const api = () => backend
let timer: number | undefined
let known = new Set<string>()

window.addEventListener('hashchange', () => set({ page: readHash() }))
export function navigate(page: Page) {
  if (location.hash !== `#/${page}`) history.replaceState(null, '', `#/${page}`)
  set({ page })
}
export function openAlert(id: string) { set({ focusAlertId: id }); navigate('investigations') }

export async function refresh(opts: { silent?: boolean } = {}) {
  if (!state.user) return
  if (!opts.silent) set({ loading: true })
  try {
    const [overview, daily, alerts, transactions, rules, ruleStats, accounts, audit, merchants] = await Promise.all([
      backend.overview(), backend.daily(14), backend.alerts(), backend.transactions(500), backend.rules(), backend.ruleStats(), backend.accounts(), backend.audit(500),
      // Logos are decorative: a failed merchant lookup must never take the dashboard down.
      backend.merchants().catch(() => state.merchants),
    ])
    const fresh = transactions.filter(t => !known.has(t.id))
    if (state.loaded && fresh.length) {
      const risky = fresh.filter(t => t.risk_score >= 60)
      if (risky.length) toast.warning(`${risky.length} new high-risk transaction${risky.length > 1 ? 's' : ''}`, { description: `${risky[0].counterparty} · ${risky[0].amount} ${risky[0].currency}` })
    }
    known = new Set(transactions.map(t => t.id))
    set({ overview, daily, alerts, transactions, rules, ruleStats, accounts, audit, merchants, error: '', live: true, lastUpdated: new Date(), loaded: true, loading: false })
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) { logout(); toast.info('Session expired', { description: 'Please sign in again.' }); return }
    set({ live: false, loading: false, error: e instanceof Error ? e.message : 'Failed to load data' })
  }
}

function startPolling() {
  stopPolling()
  timer = window.setInterval(() => { if (!document.hidden) void refresh({ silent: true }) }, POLL_MS)
}
const stopPolling = () => { if (timer) window.clearInterval(timer); timer = undefined }

async function begin(session: { access_token: string; user: User }, demo: boolean) {
  backend = demo ? demoBackend : liveBackend
  setAccessToken(demo ? null : session.access_token)
  known = new Set()
  set({ user: session.user, demo, loaded: false, error: '' })
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, demo })) } catch { /* storage unavailable */ }
  await refresh()
  startPolling()
  const { finishBankImport } = await import('@/services/bank')
  await finishBankImport()
}

export async function login(email: string, password: string) { await begin(await liveBackend.login(email, password), false) }
export async function enterDemo(email = 'admin@demo.local') { await begin(await demoBackend.login(email, ''), true) }

/** User-initiated sign-out: revoke the token on the server (best effort), then clear local session state. */
export async function signOut() {
  try { await backend.logout() } catch { /* token already invalid or API unreachable: still clear locally */ }
  logout()
}
/** Open Settings on a given tab. */
export function openSettings(tab: string) { set({ settingsTab: tab }); navigate('settings') }

export function logout() {
  stopPolling(); setAccessToken(null)
  set({ user: null, demo: false, loaded: false })
  try { sessionStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
}

export async function restoreSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return
    const s = JSON.parse(raw)
    if (s.demo) await enterDemo(s.user.email); else await begin(s, false)
  } catch { logout() }
}

/** Run a mutation, toast the outcome, then refresh shared state. Resolves undefined on failure. */
export async function guarded<T>(action: () => Promise<T>, success?: string): Promise<T | undefined> {
  try {
    const result = await action()
    if (success) toast.success(success)
    await refresh({ silent: true })
    return result
  } catch (e) {
    toast.error('Action failed', { description: e instanceof Error ? e.message : 'Unknown error' })
    return undefined
  }
}

export const isAdmin = (s: State) => s.user?.role === 'admin'

/** Verified merchant for a free-text counterparty, by exact normalised name. Never guessed. */
export function useMerchantLookup() {
  const { merchants } = useApp()
  const byName = new Map(merchants.map(m => [m.normalized_name, m]))
  return (counterparty: string): Merchant | undefined => byName.get(normalizeName(counterparty))
}
