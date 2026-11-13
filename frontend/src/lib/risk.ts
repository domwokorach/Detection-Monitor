export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

/** Score bands shared by every badge, chart and filter so colours never disagree. */
export function riskLevel(score: number): RiskLevel {
  if (score >= 80) return 'critical'
  if (score >= 60) return 'high'
  if (score >= 40) return 'medium'
  return 'low'
}

export const RISK_META: Record<RiskLevel, { label: string; color: string; glyph: string }> = {
  low: { label: 'Low', color: '#64C9DE', glyph: '●' },
  medium: { label: 'Medium', color: '#D9AA56', glyph: '▲' },
  high: { label: 'High', color: '#F1A052', glyph: '◆' },
  critical: { label: 'Critical', color: '#E85D68', glyph: '⬢' },
}

/** Alert-queue bands: 60–69 Elevated, 70–84 High, 85–100 Critical. Below 60 is still alerting, so "Moderate". */
export type AlertRiskLevel = 'moderate' | 'elevated' | 'high' | 'critical'
export function alertRiskLevel(score: number): AlertRiskLevel {
  if (score >= 85) return 'critical'
  if (score >= 70) return 'high'
  if (score >= 60) return 'elevated'
  return 'moderate'
}
export const ALERT_RISK_META: Record<AlertRiskLevel, { label: string; color: string; glyph: string }> = {
  moderate: { label: 'Moderate', color: RISK_META.medium.color, glyph: RISK_META.medium.glyph },
  elevated: { label: 'Elevated', color: '#E3B866', glyph: '▲' },
  high: { label: 'High', color: RISK_META.high.color, glyph: RISK_META.high.glyph },
  critical: { label: 'Critical', color: RISK_META.critical.color, glyph: RISK_META.critical.glyph },
}
