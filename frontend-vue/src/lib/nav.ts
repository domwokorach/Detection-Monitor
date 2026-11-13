import type { Page } from '@/types'

/** Sidebar order. Pages without a dedicated screen yet render <Placeholder>. */
export const NAV_PAGES: { id: Page; label: string }[] = [
  { id: 'overview', label: 'Overview' }, { id: 'alerts', label: 'Alerts' }, { id: 'transactions', label: 'Transactions' },
  { id: 'customers', label: 'Customers' }, { id: 'rules', label: 'Risk Scoring' }, { id: 'watchlists', label: 'Watchlists' },
  { id: 'workspace', label: 'Investigations' }, { id: 'cases', label: 'Cases' }, { id: 'reports', label: 'Reports' },
  { id: 'audit', label: 'Compliance' }, { id: 'settings', label: 'Settings' },
]
export const TOP_TABS: { id: Page; label: string }[] = [
  { id: 'overview', label: 'Dashboard' }, { id: 'transactions', label: 'Monitoring' }, { id: 'workspace', label: 'Investigations' },
  { id: 'cases', label: 'Cases' }, { id: 'reports', label: 'Reports' }, { id: 'audit', label: 'Compliance' },
]
