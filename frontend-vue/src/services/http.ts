import type { Backend } from '@/types'

let accessToken: string | null = null
export function setAccessToken(token: string | null) { accessToken = token }

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body) headers.set('Content-Type', 'application/json')
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  let response: Response
  try { response = await fetch(`/api${path}`, { ...options, headers }) }
  catch { throw new ApiError(0, 'Cannot reach the API. Check that the backend is running.') }
  let payload: unknown = null
  try { payload = await response.json() } catch { /* empty body */ }
  if (!response.ok) {
    const detail = (payload as { detail?: string | { msg: string }[] } | null)?.detail
    const message = typeof detail === 'string' ? detail
      : Array.isArray(detail) ? detail.map(v => v.msg).join('; ')
      : `Request failed (${response.status})`
    throw new ApiError(response.status, message)
  }
  return payload as T
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) })

/** Typed client for the FastAPI backend (see backend/app/api.py). */
export const liveBackend: Backend = {
  logout: async () => { await request('/auth/logout', { method: 'POST' }) },
  login: (email, password) => request('/auth/login', json('POST', { email, password })),
  overview: () => request('/overview'),
  daily: days => request(`/analytics/daily?days=${days}`),
  accounts: () => request('/accounts'),
  transactions: (limit = 500) => request(`/transactions?limit=${limit}`),
  alerts: () => request('/alerts?limit=500'),
  alert: id => request(`/alerts/${id}`),
  reviewAlert: (id, body) => request(`/alerts/${id}`, json('PATCH', body)),
  rules: () => request('/rules'),
  ruleStats: () => request('/rules/stats'),
  createRule: body => request('/rules', json('POST', body)),
  updateRule: (id, body) => request(`/rules/${id}`, json('PATCH', body)),
  audit: (limit = 500) => request(`/audit?limit=${limit}`),
  bankConnectUrl: () => request('/truelayer/connect'),
  bankImport: (code, state) => request('/truelayer/import', json('POST', { code, state })),
}
