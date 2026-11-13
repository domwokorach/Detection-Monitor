import { LegalPage, type LegalSection } from '@/components/app/legal-page'

const sections: LegalSection[] = [
  { id: 'commitment', heading: 'Our commitment', body: <p>We want every analyst to be able to use Detection-monitor. We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.2 level AA. The platform has not yet been independently audited, so full conformance is not claimed and some areas are only partly accessible.</p> },
  { id: 'support', heading: 'What is supported', body: <ul>
    <li>Everything except freehand map gestures can be used with a keyboard, with a visible focus indicator and a skip-to-content link.</li>
    <li>Risk levels always include a text label and symbol, never colour alone.</li>
    <li>Animation is reduced or removed when your system requests reduced motion.</li>
    <li>Light and dark themes, responsive layouts and text that reflows when zoomed.</li>
    <li>Pages use headings, landmarks and labelled controls for screen readers.</li></ul> },
  { id: 'limits', heading: 'Known limitations', body: <ul>
    <li><strong>UK Risk Map:</strong> the map is a visual, pointer-driven view. The ranked list of high-risk counties beside it, and the county details panel, give the same information as text and can be used with a keyboard.</li>
    <li><strong>Charts:</strong> some charts have limited text alternatives. The underlying figures are available in tables and reports.</li>
    <li><strong>Map labels:</strong> street and place names are drawn into the map by a third-party tile service and are not exposed to screen readers.</li>
    <li><strong>Live updates:</strong> values refresh automatically, and not every change is announced to assistive technology.</li></ul> },
  { id: 'report', heading: 'Reporting an accessibility problem', body: <>
    <p>If you cannot use part of the platform, tell your Detection-monitor administrator. Please include the page, what you were trying to do, the browser and any assistive technology you use. The Operator should publish a named accessibility contact and response time here before production use.</p>
    <p>If you are not satisfied with the response, you can contact the Equality Advisory and Support Service (EASS).</p></> },
  { id: 'testing', heading: 'Testing and review', body: <p>Accessibility is checked during development by keyboard testing and review against WCAG 2.2 AA. A formal audit with assistive technology is recommended before production, and this statement must be updated with its date and outcome.</p> },
]

export default function AccessibilityPage() {
  return <LegalPage title="Accessibility" summary="How the platform supports accessible use, where it falls short today and how to report a barrier." sections={sections} />
}
