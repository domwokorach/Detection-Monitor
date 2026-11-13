/** Typed client for the investigation register, KPI summary, live event stream and CSV export (FastAPI). */
import { ApiError, authHeaders, request } from './http'

export type Severity = 'moderate' | 'elevated' | 'high' | 'critical'
export type InvestigationStatus = 'OPEN' | 'IN_REVIEW' | 'ESCALATED' | 'CLOSED'

export type RegisterRow = {
  id: string; case_ref: string; transaction_id: string; customer_reference: string; merchant_name: string
  amount: string; currency: string; suspected_exposure: string | null; confirmed_loss: string | null
  risk_score: number; severity: Severity; ip_address: string | null; ip_masked: boolean
  city: string | null; county: string | null; country: string | null; la_code: string | null
  transaction_time: string | null; detected_at: string | null; opened_at: string | null; last_updated: string | null
  assigned_to: { id: string; display_name: string } | null; status: InvestigationStatus
}
export type RegisterPage = {
  items: RegisterRow[]; total: number; page: number; page_size: number; as_of: string; cursor: number
  analysts: { id: string; display_name: string }[]; pii_masked: boolean
}
export type Summary = {
  total: number; active: number; high_risk: number; escalated: number
  suspected_exposure_gbp: string; confirmed_loss_gbp: string; exposure_excluded_cases: number
  avg_resolution_seconds: number | null; resolved_count: number; as_of: string; cursor: number
}
export type LiveEvent = { seq: number; kind: string | null; alert_id: string; actor: string; at: string }

export type Filters = { q: string; status: string; severity: string; analyst_id: string; start_date: string; end_date: string }
export const NO_FILTERS: Filters = { q: '', status: 'all', severity: '', analyst_id: '', start_date: '', end_date: '' }
export const ACTIVE_STATUSES = 'OPEN,IN_REVIEW,ESCALATED'

/** Query-string for the filters (the same parameters drive the table and the export). */
export function filterParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.q.trim()) p.set('q', f.q.trim())
  if (f.status === 'active') p.set('status', ACTIVE_STATUSES); else if (f.status !== 'all') p.set('status', f.status)
  if (f.severity) p.set('severity', f.severity)
  if (f.analyst_id) p.set('analyst_id', f.analyst_id)
  if (f.start_date) p.set('start_date', f.start_date)
  if (f.end_date) p.set('end_date', f.end_date)
  return p
}

export type ListArgs = { filters: Filters; sort: string; dir: 'asc' | 'desc'; page: number; pageSize: number }
export const fetchRegister = ({ filters, sort, dir, page, pageSize }: ListArgs) => {
  const p = filterParams(filters)
  p.set('sort', sort); p.set('direction', dir); p.set('page', String(page)); p.set('page_size', String(pageSize))
  return request<RegisterPage>(`/investigations?${p}`)
}
export const fetchSummary = () => request<Summary>('/investigations/summary')

// ------------------------------------------------------------------------------------------ live stream
/** Reads the authenticated SSE stream (fetch, not EventSource, so the Bearer header can be sent). Resolves when it ends. */
export const readEventStream = (signal: AbortSignal, after: number | null, on: (event: string, data: any) => void) =>
  readSse(`/api/investigations/stream${after != null ? `?after=${after}` : ''}`, signal, on)

/** Authenticated SSE reader (EventSource cannot send a Bearer header). Emits a synthetic `open` once connected. */
export async function readSse(url: string, signal: AbortSignal, on: (event: string, data: any) => void): Promise<void> {
  const res = await fetch(url, { headers: { ...authHeaders(), Accept: 'text/event-stream' }, signal })
  if (!res.ok || !res.body) throw new ApiError(res.status, `Stream unavailable (${res.status})`)
  on('open', null)
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) return
    buffer += value
    let end: number
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, end); buffer = buffer.slice(end + 2)
      let event = 'message', data = ''
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data += line.slice(5).trim()
      }
      if (data) { try { on(event, JSON.parse(data)) } catch { /* ignore malformed frame */ } }
    }
  }
}

// -------------------------------------------------------------------------------------------- CSV export
export type ExportScope = 'filtered' | 'page' | 'selected' | 'all'
export type ExportResult = { filename: string; rows: number; generatedAt: string | null }
export type ExportProgress = (p: { processed: number; total: number } | null) => void

const errorMessage = async (res: Response) => {
  try { const body = await res.json(); return typeof body.detail === 'string' ? body.detail : `Export failed (${res.status})` } catch { return `Export failed (${res.status})` }
}

async function saveResponse(res: Response): Promise<ExportResult> {
  const blob = await res.blob()
  const filename = /filename="?([^";]+)"?/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'detection-monitor-investigations.csv'
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return { filename, rows: Number(res.headers.get('X-Export-Rows') ?? 0), generatedAt: res.headers.get('X-Export-Generated-At') }
}

/** Server-generated CSV from a database snapshot. Small exports stream back directly; large ones return a job we poll. */
export async function downloadExport(scope: ExportScope, params: URLSearchParams, progress: ExportProgress): Promise<ExportResult> {
  const p = new URLSearchParams(params); p.set('scope', scope)
  let res: Response
  try { res = await fetch(`/api/investigations/export.csv?${p}`, { headers: authHeaders() }) } catch { throw new Error('Cannot reach the API. Check that the backend is running.') }
  if (res.status === 202) {
    const job = await res.json() as { job_id: string; total: number; status_url: string }
    progress({ processed: 0, total: job.total })
    for (;;) {
      await new Promise(r => setTimeout(r, 800))
      const s = await request<{ status: string; processed: number; total: number; error: string | null; download_url: string | null }>(job.status_url.replace(/^\/api/, ''))
      progress({ processed: s.processed, total: s.total })
      if (s.status === 'FAILED') throw new Error(`Export failed on the server${s.error ? ` (${s.error})` : ''}`)
      if (s.status === 'EXPIRED') throw new Error('Export expired before it could be downloaded')
      if (s.status === 'READY' && s.download_url) {
        const dl = await fetch(s.download_url, { headers: authHeaders() })
        if (!dl.ok) throw new Error(await errorMessage(dl))
        return saveResponse(dl)
      }
    }
  }
  if (!res.ok) throw new Error(await errorMessage(res))
  return saveResponse(res)
}
