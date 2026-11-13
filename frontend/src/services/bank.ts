import { toast } from 'sonner'
import { api, getState, guarded, set } from '@/store/app'

const PENDING_KEY = 'sentinel.truelayer'

/** Lifts ?code&state off the TrueLayer callback URL at startup so the code never lingers in history. */
export function captureBankCallback() {
  if (location.pathname !== '/truelayer/callback') return
  const q = new URLSearchParams(location.search)
  const code = q.get('code'), state = q.get('state')
  try {
    if (code && state) sessionStorage.setItem(PENDING_KEY, JSON.stringify({ code, state }))
    else if (q.get('error')) toast.error('Bank connection cancelled', { description: q.get('error_description') ?? q.get('error') ?? undefined })
  } catch { /* storage unavailable */ }
  history.replaceState(null, '', '/#/settings')
  set({ page: 'settings' })
}

/** Call after sign-in: completes a pending sandbox import, then refreshes shared state. */
export async function finishBankImport() {
  let pending: { code: string; state: string } | null = null
  try { pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? 'null'); sessionStorage.removeItem(PENDING_KEY) } catch { /* ignore */ }
  if (!pending || getState().demo) return
  const r = await guarded(() => api().bankImport(pending!.code, pending!.state))
  if (r) toast.success('Bank connected (sandbox)', { description: `${r.imported} imported, ${r.skipped} skipped across ${r.accounts} account(s).` })
}
