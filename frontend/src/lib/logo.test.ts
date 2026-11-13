import { describe, expect, it, vi } from 'vitest'
import { logoUrl, publishableKey, sanitizeDomain } from './logo'
import { normalizeName } from './merchant'
import { alertRiskLevel } from './risk'

describe('sanitizeDomain', () => {
  it.each([
    ['barclays.co.uk', 'barclays.co.uk'], ['  WWW.Tesco.com. ', 'tesco.com'], ['xn--bcher-kva.de', 'xn--bcher-kva.de'],
  ])('accepts %s', (input, out) => expect(sanitizeDomain(input)).toBe(out))

  it.each([
    'https://evil.com', 'evil.com/path', 'evil.com?x=1', 'evil.com:8080', 'user@evil.com', 'localhost', '127.0.0.1', '[::1]',
    'a.b', 'exa mple.com', 'evil.com#frag', 'évil.com', '', '.com', 'a..com', '-a.com', 'x.com\nHost: y',
  ])('rejects %j', input => expect(sanitizeDomain(input)).toBeNull())

  it('rejects non-strings', () => { for (const v of [null, undefined, 5, {}, ['a.com']]) expect(sanitizeDomain(v)).toBeNull() })
})

describe('publishableKey', () => {
  it('only accepts pk_ keys, never a secret key', () => {
    expect(publishableKey('pk_abcDEF123456')).toBe('pk_abcDEF123456')
    expect(publishableKey('sk_abcDEF123456')).toBeNull()
    expect(publishableKey('')).toBeNull()
    vi.stubEnv('VITE_LOGO_DEV_PUBLISHABLE_KEY', '')  // the default reads the env; do not depend on a developer's .env
    expect(publishableKey(undefined)).toBeNull()
    vi.unstubAllEnvs()
  })
})

describe('logoUrl', () => {
  const key = 'pk_testkey12345'
  it('builds a CDN URL with the key, size, theme and a 404 fallback', () => {
    const url = new URL(logoUrl('www.Barclays.co.uk', { size: 36, theme: 'dark', key })!)
    expect(url.origin + url.pathname).toBe('https://img.logo.dev/barclays.co.uk')
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ token: key, size: '36', theme: 'dark', fallback: '404', retina: 'true' })
  })
  it('clamps size', () => {
    expect(new URL(logoUrl('a.com', { size: 9999, key })!).searchParams.get('size')).toBe('128')
    expect(new URL(logoUrl('a.com', { size: 1, key })!).searchParams.get('size')).toBe('16')
  })
  it('refuses untrusted domains and missing keys', () => {
    expect(logoUrl('https://evil.com/?token=x', { key })).toBeNull()
    expect(logoUrl('evil.com/../x', { key })).toBeNull()
    expect(logoUrl('barclays.co.uk', { key: null })).toBeNull()
  })
  it('cannot be tricked into changing host via the domain', () => {
    for (const d of ['evil.com@img.logo.dev', 'img.logo.dev@evil.com', 'a.com\\@evil.com']) expect(logoUrl(d, { key })).toBeNull()
  })
})

describe('merchant + risk helpers', () => {
  it('normalises names like the backend', () => {
    expect(normalizeName('  M&S  Food-Hall ')).toBe('m s food hall')
    expect(normalizeName('TESCO')).toBe(normalizeName('tesco'))
  })
  it('maps alert bands 60/70/85', () => {
    expect([59, 60, 69, 70, 84, 85, 100].map(alertRiskLevel)).toEqual(['moderate', 'elevated', 'elevated', 'high', 'high', 'critical', 'critical'])
  })
})

import { duration, londonTime, londonZone, utcTime } from './time'
describe('time helpers', () => {
  it('handles GMT/BST automatically', () => {
    expect(londonZone('2026-01-15T12:00:00Z')).toBe('GMT')
    expect(londonZone('2026-07-15T12:00:00Z')).toBe('BST')
    expect(londonTime('2026-07-15T12:00:00Z')).toContain('13:00:00')
    expect(londonTime('2026-01-15T12:00:00Z')).toContain('12:00:00')
  })
  it('formats UTC and durations', () => {
    expect(utcTime('2026-01-15T12:00:00.123Z')).toBe('2026-01-15 12:00:00 UTC')
    expect([null, 0.2, 5.25, 125, 4000].map(duration)).toEqual(['—', '<1 s', '5.3 s', '2 min 5 s', '1 h 6 min'])
  })
})
