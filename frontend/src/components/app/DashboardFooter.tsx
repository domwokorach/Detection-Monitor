import { ShieldCheck } from 'lucide-react'
import { DetectionMonitorMark } from '@/components/brand/DetectionMonitorLogo'
import { useApp } from '@/store/app'
import { cn } from '@/lib/utils'
import type { Page } from '@/types'

const LINKS: { page: Page; label: string }[] = [
  { page: 'terms', label: 'Terms & Conditions' },
  { page: 'privacy', label: 'Privacy Policy' },
  { page: 'security', label: 'Risk & Security' },
  { page: 'accessibility', label: 'Accessibility' },
]

/** Understated enterprise footer. Colours come from the theme tokens, which equal the brief's navy palette in dark mode. */
export function DashboardFooter() {
  const { page } = useApp()
  return (
    <footer className="mt-4 border-t border-border bg-background">
      <div className="mx-auto grid w-full max-w-[1600px] items-center gap-x-6 gap-y-3 px-4 py-4 lg:grid-cols-[1fr_auto_1fr] lg:px-5">
        <div className="flex items-center gap-2.5">
          <DetectionMonitorMark size={22} />
          <div className="leading-tight">
            <p className="text-xs font-bold text-foreground">Detection Monitor</p>
            <p className="text-[11px] text-muted-foreground">© {new Date().getFullYear()} Detection Monitor. All rights reserved.</p>
          </div>
        </div>
        <nav aria-label="Legal and support" className="-mx-2 lg:mx-0">
          <ul className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
            {LINKS.map(l => {
              const active = page === l.page
              return (
                <li key={l.page}>
                  <a href={`#/${l.page}`} aria-current={active ? 'page' : undefined}
                    className={cn('inline-flex min-h-11 items-center rounded-[5px] px-2 text-xs font-medium underline-offset-4 outline-none transition-colors duration-150 ease-out hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:min-h-9',
                      active ? 'text-hl underline' : 'text-muted-foreground')}>{l.label}</a>
                </li>
              )
            })}
          </ul>
        </nav>
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground lg:justify-end">
          <ShieldCheck className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
          Role-based access · Audited activity
        </p>
      </div>
    </footer>
  )
}
