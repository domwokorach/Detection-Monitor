import { LegalPage, type LegalSection } from '@/components/app/legal-page'

const sections: LegalSection[] = [
  { id: 'overview', heading: 'Our approach', body: <p>The platform is built to limit who can see sensitive financial data, to make every significant action traceable and to be honest about what the data can and cannot prove. This page describes what is implemented. It is not an assurance report.</p> },
  { id: 'access', heading: 'Authentication and access control', body: <ul>
    <li>Sign-in uses signed, expiring tokens (eight hours by default). Signing out revokes the token on the server.</li>
    <li>Passwords are stored as Argon2 hashes.</li>
    <li>Analyst and admin roles are enforced by the API. Personal fields such as addresses are masked unless the role permits access.</li>
    <li>Secrets and API keys are supplied through the environment and are never sent to the browser; the Logo.dev secret key is used by the backend only.</li></ul> },
  { id: 'data', heading: 'Data protection', body: <ul>
    <li>Money is stored as exact decimals, not floating point, and ingestion is idempotent so a repeated payment cannot create a duplicate.</li>
    <li>Rule changes are versioned and use optimistic concurrency, so two analysts cannot silently overwrite each other.</li>
    <li>Transport encryption and encryption at rest depend on deployment. Run the platform behind HTTPS, use managed database encryption and replace all development secrets before exposure to a network.</li></ul> },
  { id: 'audit', heading: 'Audit and integrity', body: <p>Reviews, assignments, rule changes and similar actions are recorded in an append-only, hash-chained audit history. Administrators can verify the chain, which makes after-the-fact tampering detectable.</p> },
  { id: 'risk', heading: 'Risk management', body: <>
    <p>Alerts are raised by configurable rules and scored 0–100. Scores of 60 and above are treated as high-risk: Elevated 60–69, High 70–84, Critical 85–100. Every alert is reviewed by a person who records a disposition and note.</p>
    <p>Geographic views use the local authority held on the account. IP-based location is shown as a provider estimate, never as a verified or street-level position.</p></> },
  { id: 'assurance', heading: 'Certifications and assurance', body: <p>Detection-monitor has <strong>no</strong> security certification (such as ISO 27001 or SOC 2) and has not been through an independent penetration test or regulatory approval. None is claimed. Operators should carry out their own risk assessment before processing live customer data.</p> },
  { id: 'report', heading: 'Reporting a vulnerability', body: <>
    <p>If you find a security weakness, please report it privately so it can be fixed before it is made public. Contact your organisation’s Detection-monitor administrator or security team; the Operator must publish a dedicated security contact here before production use.</p>
    <ul><li>Describe what you found, the steps to reproduce it and its likely impact.</li><li>Do not access, change or keep data that is not yours, and do not disrupt the service.</li><li>Allow reasonable time for a fix before disclosing details.</li></ul>
    <p>Reports will be acknowledged and triaged, and reporters acting in good faith will be kept informed of progress.</p></> },
]

export default function SecurityPage() {
  return <LegalPage title="Risk & Security" summary="How the platform protects data, manages fraud risk and handles responsible vulnerability reports." sections={sections} />
}
