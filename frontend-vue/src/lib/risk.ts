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
