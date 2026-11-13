import { LegalPage, type LegalSection } from '@/components/app/legal-page'

const sections: LegalSection[] = [
  { id: 'who', heading: 'Who is responsible', body: <>
    <p>Detection Monitor is software. The organisation that deploys it (the “Operator”) decides why and how personal information is processed and is the controller under UK GDPR and the Data Protection Act 2018. The Operator’s name, address and data-protection contact must be added here before publication.</p></> },
  { id: 'collect', heading: 'Information we collect', body: <>
    <ul>
      <li><strong>Platform users:</strong> name, work email, role, a salted password hash (never the password), sign-in and session records.</li>
      <li><strong>Customers and transactions:</strong> account holder name, masked account number, amounts, currency, direction, counterparty, country and timestamps.</li>
      <li><strong>Optional location data:</strong> the UK local authority recorded for an account, an address where an authorised source supplies one, and IP address telemetry with provider-estimated location, ISP and reputation. IP-based location is an estimate, never verified.</li>
      <li><strong>Investigation records:</strong> alerts, scores, rule matches, reviewer notes, dispositions and cases.</li>
      <li><strong>Audit records:</strong> who did what and when, kept in a tamper-evident chain.</li>
    </ul></> },
  { id: 'why', heading: 'Why we process it', body: <>
    <p>To detect, investigate and prevent fraud and financial crime, to meet legal and regulatory obligations, to keep the platform secure, and to evidence the decisions analysts make. The Operator must record its lawful basis for each purpose (commonly legitimate interests and legal obligation) and, where special-category or criminal-offence data may arise, the additional condition relied on.</p>
    <p>Risk scores come from configurable rules. They support, and do not replace, human review of any decision that significantly affects a person.</p></> },
  { id: 'share', heading: 'Who it is shared with', body: <>
    <p>Data stays in the Operator’s database and cache (PostgreSQL and Redis). Depending on configuration, limited data goes to:</p>
    <ul><li><strong>TrueLayer</strong>, when a bank connection is used, to fetch accounts and transactions;</li><li><strong>Logo.dev</strong>: merchant names are sent from the server to suggest domains, and your browser requests logo images by domain;</li><li><strong>OpenFreeMap</strong>: your browser requests map tiles, which reveals your IP address and the area being viewed.</li></ul>
    <p>The platform does not include advertising or third-party analytics trackers. The Operator must confirm any international transfers made by these providers and the safeguards in place.</p></> },
  { id: 'retain', heading: 'How long we keep it', body: <p>Retention periods for transactions, alerts, cases and audit records are set by the Operator and must reflect its regulatory record-keeping duties; they are to be stated here before publication. Sign-in tokens expire after a fixed period (eight hours by default) and revoked tokens are purged once expired. Audit entries are designed not to be altered, so corrections are made by adding a new entry.</p> },
  { id: 'protect', heading: 'How we protect it', body: <p>Access is role-based, sensitive personal fields are masked by role, passwords are stored with Argon2, activity is audited and secrets are held outside the code. Details are on the <a href="#/security">Risk &amp; Security</a> page. Transport encryption (HTTPS) and database encryption depend on how the Operator deploys the platform.</p> },
  { id: 'storage', heading: 'Browser storage', body: <p>The platform keeps your sign-in session in session storage (cleared when the browser tab closes) and your light or dark theme choice in local storage. It does not set advertising cookies.</p> },
  { id: 'rights', heading: 'Your rights', body: <>
    <p>You may ask the Operator for access to your personal information, correction, erasure, restriction, or to object to processing, and in some cases to receive a copy in a portable format. Some rights are limited where fraud prevention, crime detection or legal obligations apply, and the Operator will explain when that is the case.</p>
    <p>You can complain to the Information Commissioner’s Office at <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer">ico.org.uk</a>.</p></> },
  { id: 'updates', heading: 'Changes and contact', body: <p>This policy is updated when processing changes; the date of the last review is to be recorded by the Operator. Contact the Operator’s data-protection lead for any privacy question.</p> },
]

export default function PrivacyPage() {
  return <LegalPage title="Privacy Policy" summary="What personal information the platform collects, why it is processed, how long it is kept and how it is protected." sections={sections} />
}
