/** Logo.dev CDN helpers. Only a validated hostname and a publishable key ever enter an image URL. */
const HOST = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,24}|xn--[a-z0-9-]{2,59})$/

/** Mirrors the backend's clean_domain: bare hostname only (no scheme, path, port, credentials or IPs). */
export function sanitizeDomain(input: unknown): string | null {
  if (typeof input !== 'string') return null
  let host = input.trim().toLowerCase().replace(/\.$/, '')
  if (host.startsWith('www.')) host = host.slice(4)
  return HOST.test(host) ? host : null
}

/** A secret key (sk_) must never be used here; only publishable keys are accepted. */
export function publishableKey(raw: string | undefined = import.meta.env.VITE_LOGO_DEV_PUBLISHABLE_KEY): string | null {
  const key = raw?.trim()
  return key && /^pk_[A-Za-z0-9_-]{8,}$/.test(key) ? key : null
}

export type LogoTheme = 'light' | 'dark'

/**
 * https://img.logo.dev/{domain}?token=… with fallback=404 so a missing logo triggers our own
 * placeholder instead of Logo.dev's generated monogram. Returns null when it cannot be built safely.
 */
export function logoUrl(domain: unknown, opts: { size?: number; theme?: LogoTheme; key?: string | null } = {}): string | null {
  const host = sanitizeDomain(domain)
  const token = opts.key === undefined ? publishableKey() : opts.key
  if (!host || !token) return null
  const size = Math.min(128, Math.max(16, Math.round(opts.size ?? 36)))
  const params = new URLSearchParams({ token, size: String(size), format: 'webp', retina: 'true', fallback: '404' })
  if (opts.theme) params.set('theme', opts.theme)
  return `https://img.logo.dev/${host}?${params}`
}
