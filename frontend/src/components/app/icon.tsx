import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'

/** Hugeicons with the dashboard's defaults: light-blue stroke, 1.6 weight. Inherits colour via currentColor. */
export function Icon({ icon, size = 16, className }: { icon: IconSvgElement; size?: number; className?: string }) {
  return <HugeiconsIcon icon={icon} size={size} strokeWidth={1.6} color="currentColor" className={className} aria-hidden="true" />
}
