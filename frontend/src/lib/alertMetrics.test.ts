import { describe, expect, it } from 'vitest'
import { exposure, gbpShort, isConfirmed, series } from './alertMetrics'
import type { Alert } from '@/types'

const NOW = Date.parse('2026-11-13T12:00:00Z')
const mk = (id: string, tx: string, amount: string, over: Partial<Alert> = {}, currency = 'GBP'): Alert => ({
  id, transaction_id: tx, status: 'OPEN', priority: 'HIGH', risk_score: 70, assigned_to: null, disposition: null, review_note: null,
  created_at: '2026-11-13T11:30:00Z', updated_at: '2026-11-13T11:30:00Z',
  transaction: { id: tx, external_id: tx, account_id: 'a', amount, currency, direction: 'DEBIT', counterparty: 'X', country: 'GB', occurred_at: '2026-11-13T11:30:00Z', screening_status: 'SCREENED', risk_score: 70 }, ...over,
})

describe('alert metrics', () => {
  it('counts a transaction once even when several alerts reference it', () => {
    expect(exposure([mk('1', 't1', '100.00'), mk('2', 't1', '100.00'), mk('3', 't2', '50.50')])).toMatchObject({ total: 150.5, unique: 2 })
  })
  it('excludes non-GBP value instead of converting it', () => {
    expect(exposure([mk('1', 't1', '100', {}, 'USD'), mk('2', 't2', '20')])).toMatchObject({ total: 20, excluded: 1 })
  })
  it('only treats closed suspicious alerts as confirmed', () => {
    expect(isConfirmed(mk('1', 't', '1', { status: 'CLOSED', disposition: 'SUSPICIOUS' }))).toBe(true)
    expect(isConfirmed(mk('1', 't', '1', { status: 'CLOSED', disposition: 'FALSE_POSITIVE' }))).toBe(false)
    expect(isConfirmed(mk('1', 't', '1', { status: 'ESCALATED', disposition: 'SUSPICIOUS' }))).toBe(false)
  })
  it('keeps confirmed value separate from suspected exposure in the series', () => {
    const s = series([mk('1', 't1', '100'), mk('2', 't2', '40', { status: 'CLOSED', disposition: 'SUSPICIOUS' })], '24h', NOW)
    expect(s.reduce((n, b) => n + b.exposure, 0)).toBe(140)
    expect(s.reduce((n, b) => n + b.confirmed, 0)).toBe(40)
  })
  it('formats GBP', () => {
    expect(gbpShort(12450)).toBe('£12,450.00')
    expect(gbpShort(1_250_000)).toBe('£1.25M')
  })
})
