import { LegalPage, type LegalSection } from '@/components/app/legal-page'

const sections: LegalSection[] = [
  { id: 'scope', heading: 'About these terms', body: <>
    <p>Detection Monitor is a transaction-monitoring and fraud-investigation platform. These terms govern use of the platform by people your organisation has authorised. By signing in you confirm that you have read them and will follow them together with your organisation’s own policies.</p>
    <p>The organisation that deploys and administers this instance (the “Operator”) is responsible for the data processed in it. Where these terms refer to “we”, they mean the Operator.</p></> },
  { id: 'access', heading: 'Authorised access', body: <>
    <p>Access is limited to named individuals. Two roles exist: <strong>analyst</strong> (review alerts and cases) and <strong>admin</strong> (also manages risk rules and configuration). Sensitive personal fields are masked unless your role allows you to see them.</p>
    <ul><li>Keep your credentials confidential and do not share sessions.</li><li>Sign out on shared devices. Sessions expire automatically and can be revoked by signing out.</li><li>Tell your administrator immediately if you suspect your account has been misused.</li></ul></> },
  { id: 'use', heading: 'Acceptable use', body: <>
    <p>You may use the platform only for fraud detection, prevention, investigation and related compliance work. You must not:</p>
    <ul><li>access, search or export data without a legitimate work purpose;</li><li>attempt to bypass access controls, audit logging or rate limits, or probe the platform for weaknesses outside an agreed test;</li><li>disclose to a customer or other third party that an alert, investigation or report exists, unless your organisation’s procedures allow it;</li><li>use the data for marketing, credit decisions or any purpose not covered by your organisation’s lawful basis.</li></ul></> },
  { id: 'decisions', heading: 'Risk scores and analyst decisions', body: <>
    <p>Risk scores, bands and alerts are produced by configurable rules and are <strong>decision support, not a finding of fraud</strong>. Elevated is 60–69, High 70–84 and Critical 85–100. A person must review evidence before an account is restricted, a customer is contacted or a report is made.</p>
    <p>Location shown on maps is derived from the local authority recorded on an account, or from provider estimates for IP addresses. It is approximate and must not be treated as the verified location of a person or a transaction.</p></> },
  { id: 'records', heading: 'Audit and monitoring', body: <p>Sign-ins, alert reviews, rule changes and similar actions are written to a tamper-evident audit history. Your activity may be reviewed by your organisation for security, compliance and quality purposes.</p> },
  { id: 'third', heading: 'Third-party services and data', body: <>
    <p>Depending on configuration, the platform uses services run by others: an open-banking provider (TrueLayer, sandbox by default) to import accounts and transactions; Logo.dev for merchant logos; OpenStreetMap-based map tiles served by OpenFreeMap; and Office for National Statistics boundary data published under the Open Government Licence v3.0. Their own terms apply to those services.</p>
    <p>Demo mode uses simulated data held in your browser’s memory only and is clearly labelled.</p></> },
  { id: 'availability', heading: 'Availability and changes', body: <p>The platform is provided on an “as available” basis and may be changed, suspended or withdrawn for maintenance, security or legal reasons. These terms may be updated; continued use after an update means you accept the revised terms.</p> },
  { id: 'liability', heading: 'Liability and governing law', body: <>
    <p>Nothing in these terms limits liability that cannot lawfully be limited. Subject to that, the Operator’s liability for use of the platform, and the allocation of responsibility between the Operator and its suppliers, is to be set out here by the Operator’s legal advisers.</p>
    <p>Governing law and jurisdiction (for example the law of England and Wales) are to be confirmed by the Operator before publication.</p></> },
  { id: 'contact', heading: 'Questions', body: <p>Contact your Detection Monitor administrator for questions about these terms. See also the <a href="#/privacy">Privacy Policy</a> and <a href="#/security">Risk &amp; Security</a> pages.</p> },
]

export default function TermsPage() {
  return <LegalPage title="Terms & Conditions" summary="The rules for using this fraud-monitoring platform, for authorised users of the Operator’s organisation." sections={sections} />
}
