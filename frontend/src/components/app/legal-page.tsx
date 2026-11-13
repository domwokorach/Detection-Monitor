import type { ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'

export type LegalSection = { id: string; heading: string; body: ReactNode }

/** Shared layout for the four policy pages: title, review notice, on-page contents and numbered sections. */
export function LegalPage({ title, summary, sections }: { title: string; summary: string; sections: LegalSection[] }) {
  return (
    <article className="mx-auto max-w-5xl" aria-labelledby="legal-title">
      <header className="mb-5 border-b border-border pb-5">
        <h1 id="legal-title" className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">{summary}</p>
        <div role="note" className="mt-4 flex max-w-3xl items-start gap-2 rounded-[5px] border border-sev-med/30 bg-sev-med/10 px-3 py-2 text-xs text-sev-med">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <p><strong>Draft for review.</strong> This text describes how the platform is built and is not legal advice. The deploying organisation and its legal and compliance advisers must review and complete it before it is published to users.</p>
        </div>
      </header>
      <div className="grid gap-8 lg:grid-cols-[13rem_1fr]">
        <nav aria-label={`${title} contents`} className="lg:sticky lg:top-20 lg:self-start">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">On this page</p>
          <ol className="space-y-0.5 text-xs">
            {sections.map((s, i) => (
              <li key={s.id}><a href={`#${s.id}`} onClick={e => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ block: 'start' }); document.getElementById(s.id)?.focus({ preventScroll: true }) }}
                className="block rounded-[5px] px-2 py-1.5 text-muted-foreground outline-none transition-colors duration-150 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring">{i + 1}. {s.heading}</a></li>
            ))}
          </ol>
        </nav>
        <div className="max-w-3xl space-y-7">
          {sections.map((s, i) => (
            <section key={s.id} aria-labelledby={s.id} className="scroll-mt-20">
              <h2 id={s.id} tabIndex={-1} className="mb-2 text-base font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="tech mr-2 text-primary">{i + 1}.</span>{s.heading}</h2>
              <div className="space-y-2.5 text-sm leading-relaxed text-muted-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_li]:pl-1 [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">{s.body}</div>
            </section>
          ))}
        </div>
      </div>
    </article>
  )
}
