export type Address = { line1?: string | null; line2?: string | null; city?: string | null; county?: string | null; postcode?: string | null; country?: string | null; source?: string | null }
export type IpIntel = {
  address: string; masked: boolean; version: 4 | 6
  telemetry: { source: string; captured_at: string }
  /** Provider ESTIMATE derived from the IP; never a verified location. Every field may be null. */
  geo: { country: string | null; region: string | null; county: string | null; city: string | null; la_code: string | null; lat: number | null; lon: number | null; accuracy_km: number | null; provider: string | null; confidence: 'low' | 'medium' | 'high' | null; inferred: true }
  network: { isp: string | null; asn: string | null }
  vpn_proxy: boolean | null; reputation: 'clean' | 'suspicious' | 'malicious' | null
  first_seen: string; last_seen: string; related_transactions: number; related_alerts: number; accounts_sharing: number
}
export type RiskFactor = { code: string; label: string; status: 'flagged' | 'clear' | 'unavailable'; explanation: string; evidence: string | null }
export type TimelineItem = { kind: 'received' | 'rules' | 'alert' | 'assigned' | 'opened' | 'evidence' | 'note' | 'escalated' | 'closed'; title: string; at: string; actor: string; detail: string | null; entry_hash: string | null; seq: number | null }
export type GeoPoint = { transaction_id: string; risk_score: number; lat: number; lon: number; city: string | null; country: string | null; la_code: string | null; accuracy_km: number | null; counterparty: string; amount: string; currency: string; occurred_at: string; current: boolean }
export type Investigation = {
  alert_id: string; case_ref: string; can_view_pii: boolean
  account: { id: string; holder_name: string | null; account_number_masked: string | null; home_country: string | null }
  merchant: { name: string; domain: string | null }
  assignee: { id: string; display_name: string } | null
  timestamps: { transaction: string; received: string | null; detected: string; opened: string; last_activity: string; reviewed: string | null; processing_seconds: number | null }
  ip: IpIntel | null
  addresses: { masked: boolean; customer: Address | null; merchant: Address | null }
  factors: RiskFactor[]
  linked: { alert_id: string; risk_score: number; status: string; counterparty: string; reason: string; created_at: string }[]
  related_points: GeoPoint[]
  timeline: TimelineItem[]
}
export type Page = 'command' | 'transactions' | 'map' | 'alerts' | 'rules' | 'investigations' | 'cases' | 'watchlist' | 'audit' | 'reports' | 'inequality' | 'settings' | 'terms' | 'privacy' | 'security' | 'accessibility'
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
  id: string; rule_codes?: string[]; transaction_id: string; status: AlertStatus
  priority: 'HIGH' | 'MEDIUM' | 'LOW'; risk_score: number; assigned_to: string | null
  disposition: string | null; review_note: string | null; created_at: string; updated_at: string
  transaction: Transaction
}
export type AlertDetail = Alert & { matches: Match[] }
export type TransactionDetail = Transaction & { matches: Match[] }
/** A counterparty name an analyst (or the seed) has bound to a known website domain. */
export type Merchant = { id: string; name: string; normalized_name: string; domain: string; verified_by: string; created_at: string }
/** Unverified Logo.dev search suggestion. A candidate is not proof of identity. */
export type BrandCandidate = { name: string; domain: string; logo_url: string }
export type BrandSearch = { query: string; candidates: BrandCandidate[]; cached: boolean }
export type AlertReview = {
  status: AlertStatus; disposition?: 'SUSPICIOUS' | 'FALSE_POSITIVE' | null
  note?: string | null; assign_to_me?: boolean
  /** GBP loss established when closing as confirmed suspicious, e.g. "250.50". */
  confirmed_loss?: string | null
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

/** One active alert with risk_score >= 60, located by its account's UK local authority (never an IP guess or a street). */
export type RiskEvent = {
  alert_id: string; transaction_id: string; la_code: string; risk_score: number; status: AlertStatus
  amount: string; currency: string; direction: string; counterparty: string; occurred_at: string; updated_at: string
  location_basis: 'account_local_authority'
}
export type RiskMapData = { threshold: number; generated_at: string; version: string; unlocated: number; events: RiskEvent[] }

export type Backend = {
  riskMap(): Promise<RiskMapData>
  login(email: string, password: string): Promise<Session>
  logout(): Promise<void>
  overview(): Promise<Overview>
  daily(days: number): Promise<Daily[]>
  accounts(): Promise<Account[]>
  transactions(limit?: number): Promise<Transaction[]>
  transaction(id: string): Promise<TransactionDetail>
  investigation(alertId: string): Promise<Investigation>
  evidenceReviewed(alertId: string, note?: string): Promise<void>
  alerts(): Promise<Alert[]>
  alert(id: string): Promise<AlertDetail>
  reviewAlert(id: string, body: AlertReview): Promise<Alert>
  rules(): Promise<Rule[]>
  ruleStats(): Promise<RuleStat[]>
  createRule(body: RuleIn): Promise<Rule>
  updateRule(id: string, body: RuleUpdate): Promise<Rule>
  audit(limit?: number): Promise<Audit[]>
  merchants(): Promise<Merchant[]>
  verifyMerchant(name: string, domain: string): Promise<Merchant>
  brandSearch(q: string): Promise<BrandSearch>
  bankConnectUrl(): Promise<{ auth_url: string }>
  bankImport(code: string, state: string): Promise<BankImport>
}
