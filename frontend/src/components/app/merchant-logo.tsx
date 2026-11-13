import { useCallback, useState } from 'react'
import { Building03Icon } from '@hugeicons/core-free-icons'
import { Icon } from './icon'
import { Skeleton } from '@/components/ui/skeleton'
import { useTheme } from '@/hooks/use-theme'
import { logoUrl, sanitizeDomain, type LogoTheme } from '@/lib/logo'
import { cn } from '@/lib/utils'

type Props = {
  /** Verified merchant domain, e.g. "barclays.co.uk". Anything that is not a bare hostname is ignored. */
  domain?: string | null
  name: string
  /** Square size in px; clamped to 32–40 so rows stay compact. */
  size?: number
  /** "auto" follows the app theme; force a variant when the logo sits on a fixed background. */
  variant?: 'auto' | LogoTheme
  className?: string
}

/**
 * Real merchant logo from Logo.dev with a loading skeleton and a neutral fallback.
 * A logo is a visual identifier only: it is never evidence a merchant is legitimate or fraudulent.
 */
export function MerchantLogo({ domain, name, size = 36, variant = 'auto', className }: Props) {
  const { resolved } = useTheme()
  const px = Math.min(40, Math.max(32, size))
  const theme = variant === 'auto' ? resolved : variant
  const verified = sanitizeDomain(domain)
  const src = logoUrl(verified, { size: px, theme })
  // Status is keyed to the URL it was measured for, so a new src starts over without an effect.
  const [done, setDone] = useState<{ src: string; ok: boolean } | null>(null)
  const status = !src ? 'fallback' : done?.src !== src ? 'loading' : done.ok ? 'loaded' : 'fallback'
  // Cached images can finish before React attaches onLoad; check `complete` when the node mounts.
  const ref = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete && src) setDone({ src, ok: img.naturalWidth > 0 })
  }, [src])

  return (
    <span className={cn('relative inline-grid shrink-0 place-items-center overflow-hidden rounded-[8px] border bg-secondary', className)}
      style={{ width: px, height: px }}>
      {status === 'fallback' ? (
        <span role="img" aria-label={verified ? `${name} (logo unavailable)` : `${name} (no verified domain)`}
          className="grid size-full place-items-center text-subtle">
          <Icon icon={Building03Icon} size={Math.round(px * 0.5)} />
        </span>
      ) : (
        <>
          {status === 'loading' && <Skeleton className="absolute inset-0 rounded-none" aria-hidden="true" />}
          <img ref={ref} key={src} src={src!} alt={`${name} logo`} width={px} height={px} loading="lazy" decoding="async"
            referrerPolicy="strict-origin-when-cross-origin" draggable={false}
            onLoad={() => setDone({ src: src!, ok: true })} onError={() => setDone({ src: src!, ok: false })}
            className={cn('size-full object-contain p-[14%] transition-opacity duration-300', status === 'loaded' ? 'opacity-100' : 'opacity-0')} />
        </>
      )}
    </span>
  )
}
