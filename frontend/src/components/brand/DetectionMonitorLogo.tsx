import { useId, type ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/** Brand colours (see design brief). */
const LIGHT_BLUE = '#38BDF8'
const HIGHLIGHT = '#65B9EE'
const NAVY = '#071426'

type MarkProps = Omit<ComponentProps<'svg'>, 'children'> & { size?: number }

/**
 * Shield + padlock mark as pure SVG geometry (square 100×100 viewBox, transparent background).
 * Decorative by default; wrap it in a labelled link/button where it is interactive.
 */
export function DetectionMonitorMark({ size = 36, className, ...props }: MarkProps) {
  const gid = useId()
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} fill="none" aria-hidden="true" focusable="false"
      className={cn('shrink-0', className)} {...props}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={HIGHLIGHT} />
          <stop offset="1" stopColor={LIGHT_BLUE} />
        </linearGradient>
      </defs>
      {/* Outer shield */}
      <path fill={LIGHT_BLUE} d="M50 3.2C40 9.5 24 16 10.5 19.3c-1.6.4-2.6 1.2-2.6 3.2V43c0 20 14 40 39.4 53.7 1.7.9 3.7.9 5.4 0C78.1 83 92.1 63 92.1 43V22.5c0-2-1-2.8-2.6-3.2C76 16 60 9.5 50 3.2Z" />
      {/* Midnight navy interior */}
      <path fill={NAVY} d="M50 9.5c-11.5 7-23 11.5-34.8 14.8V43c0 17.5 12.5 35 34.8 48C72.3 78 84.8 60.5 84.8 43V24.3C73 21 61.5 16.5 50 9.5Z" />
      {/* Padlock */}
      <path stroke={`url(#${gid})`} strokeWidth="4.4" d="M39.05 42V37.2a10.95 10.95 0 0 1 21.9 0V42" />
      <rect x="31.7" y="41.5" width="36.2" height="27.4" rx="4.5" fill={`url(#${gid})`} />
      <circle cx="50" cy="52.4" r="4.5" fill={NAVY} />
      <path fill={NAVY} d="M47.5 55.5 46.9 62.4q0 .9.9.9h4.4q.9 0 .9-.9L52.5 55.5Z" />
    </svg>
  )
}

type LogoProps = {
  /** Mark size in px. Defaults to 36 (expanded sidebar). */
  size?: number
  /** Show the "Detection Monitor" wordmark beside the mark. */
  showName?: boolean
  /** Show the secondary caption under the name. */
  showCaption?: boolean
  /** Hide the wordmark (fading out) when the surrounding shadcn sidebar is collapsed to icons. */
  collapseWithSidebar?: boolean
  className?: string
  onNavigate?: () => void
}

/**
 * Logo lockup linking to the dashboard. Hash-routed app: `#/dashboard` resolves to the overview page.
 * The wordmark collapses/fades with `Sidebar collapsible="icon"` via the `group` data attribute.
 */
export function DetectionMonitorLogo({ size = 36, showName = true, showCaption = true, collapseWithSidebar = false, className, onNavigate }: LogoProps) {
  return (
    <a href="#/dashboard" aria-label="Detection Monitor — Dashboard" onClick={onNavigate}
      className={cn(
        'group/logo flex min-w-0 items-center rounded-[5px] outline-none',
        'focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
        className,
      )}>
      <DetectionMonitorMark size={size}
        className={cn(
          'transition-[filter] duration-200 ease-out motion-reduce:transition-none',
          'group-hover/logo:drop-shadow-[0_0_7px_rgba(56,189,248,0.55)] group-focus-visible/logo:drop-shadow-[0_0_7px_rgba(56,189,248,0.55)]',
          collapseWithSidebar && 'group-data-[collapsible=icon]:size-8',
        )} />
      {showName && (
        <span aria-hidden="true"
          className={cn(
            'ml-3 flex min-w-0 flex-col overflow-hidden leading-tight',
            collapseWithSidebar && 'max-w-[200px] transition-[max-width,margin,opacity] duration-200 ease-linear motion-reduce:transition-none group-data-[collapsible=icon]:ml-0 group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0',
          )}>
          <span className="truncate text-base font-bold tracking-[-0.3px] text-sidebar-foreground">Detection Monitor</span>
          {showCaption && <span className="truncate text-[11px] text-muted-foreground dark:text-[#8CA2BA]">Financial Intelligence Platform</span>}
        </span>
      )}
    </a>
  )
}
