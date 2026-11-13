export type Page = 'overview' | 'transactions' | 'alerts' | 'rules' | 'workspace' | 'audit'
  | 'customers' | 'watchlists' | 'cases' | 'reports' | 'settings'
export type User = { id: string; email: string; display_name: string; role: 'admin' | 'analyst'; avatar_url?: string | null }
export type Account = { id: string; account_number_masked: string; holder_name: string; home_country: string; la_code?: string | null }
export type Transaction = {
  id: string; external_id: string; account_id: string; amount: string; currency: string
  direction: string; counterparty: string; country: string; occurred_at: string
  screening_status: string; risk_score: number
}
export type Match = {
  id: string; rule_code: string; rule_version: number
  rule_config_snapshot: Record<string, unknown>; score: number; reason: string
}
export type AlertStatus = 'OPEN' | 'IN_REVIEW' | 'ESCALATED' | 'CLOSED'
export type Alert = {
  id: string; transaction_id: string; status: AlertStatus
  priority: 'HIGH' | 'MEDIUM' | 'LOW'; risk_score: number; assigned_to: string | null
  disposition: string | null; review_note: string | null; created_at: string; updated_at: string
  transaction: Transaction
}
export type AlertDetail = Alert & { matches: Match[] }
export type AlertReview = {
  status: AlertStatus; disposition?: 'SUSPICIOUS' | 'FALSE_POSITIVE' | null
  note?: string | null; assign_to_me?: boolean
}
export type RuleKind = 'AMOUNT_THRESHOLD' | 'COUNTRY_WATCHLIST' | 'VELOCITY' | 'CUMULATIVE_AMOUNT'
export type Rule = {
  id: string; code: string; name: string; description: string; kind: RuleKind
  config: Record<string, unknown>; weight: number; enabled: boolean; version: number; updated_at: string
}
export type RuleIn = {
  code: string; name: string; description: string; kind: RuleKind
  config: Record<string, unknown>; weight: number; enabled: boolean
}
export type RuleUpdate = {
  expected_version: number; name?: string; description?: string
  config?: Record<string, unknown>; weight?: number; enabled?: boolean
}
export type RuleStat = { rule_code: string; matches: number; last_matched_at: string | null }
export type Audit = {
  seq: number; id: string; actor: string; action: string; entity_type: string; entity_id: string
  before: Record<string, unknown> | null; after: Record<string, unknown> | null
  created_at: string; entry_hash: string; previous_hash: string
}
export type Overview = {
  transactions: number; screened: number; flagged: number; open_alerts: number
  high_priority: number; pending_jobs: number; alert_rate: number
}
export type Daily = { date: string; transactions: number; flagged: number }
export type BankImport = { accounts: number; imported: number; skipped: number }
export type Session = { access_token: string; token_type: string; user: User }

export type Backend = {
  login(email: string, password: string): Promise<Session>
  logout(): Promise<void>
  overview(): Promise<Overview>
  daily(days: number): Promise<Daily[]>
  accounts(): Promise<Account[]>
  transactions(limit?: number): Promise<Transaction[]>
  alerts(): Promise<Alert[]>
  alert(id: string): Promise<AlertDetail>
  reviewAlert(id: string, body: AlertReview): Promise<Alert>
  rules(): Promise<Rule[]>
  ruleStats(): Promise<RuleStat[]>
  createRule(body: RuleIn): Promise<Rule>
  updateRule(id: string, body: RuleUpdate): Promise<Rule>
  audit(limit?: number): Promise<Audit[]>
  bankConnectUrl(): Promise<{ auth_url: string }>
  bankImport(code: string, state: string): Promise<BankImport>
}
