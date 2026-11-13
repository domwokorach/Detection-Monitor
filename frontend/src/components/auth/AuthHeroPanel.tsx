import { motion, useReducedMotion } from 'motion/react'
import { AnimatedHeroText } from './AnimatedHeroText'
import { cn } from '@/lib/utils'

/** Fixed brand palette for the hero (it stays midnight navy in both themes). */
const C = { panel: '#071426', accent: '#65B9EE', text: '#F2F7FC', border: '#1B344D' }
const EASE = [0.22, 1, 0.36, 1] as const

/**
 * Left column of the sign-in page: decorative shield artwork behind the brand statement.
 * The artwork is aria-hidden; the identity is conveyed by the real text (name + h1).
 * The two chips are product capability labels, not a connection state.
 */
export function AuthHeroPanel({ className }: { className?: string }) {
  const reduced = useReducedMotion()
  return (
    <section aria-label="Detection Monitor" className={cn('relative isolate flex min-h-[19rem] items-center overflow-hidden border-b lg:min-h-svh lg:border-r lg:border-b-0', className)}
      style={{ background: C.panel, borderColor: C.border, color: C.text }}>
      {/* ---- decorative layers (hidden from assistive tech) ---- */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 select-none">
        {/* Premium cyan ambient lighting */}
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 top-1/4 size-80 rounded-full bg-sky-500/15 blur-3xl" />
        {/* Futuristic shield background */}
        <motion.img src="/images/detection-shield.png" alt="" aria-hidden="true" decoding="async" draggable={false}
          initial={reduced ? false : { opacity: 0, scale: 1.06 }} animate={{ opacity: 0.32, scale: 1 }} transition={{ duration: reduced ? 0 : 1.4, ease: EASE }}
          className="pointer-events-none absolute right-[-16%] top-1/2 z-0 w-[110%] max-w-[850px] -translate-y-1/2 object-contain select-none max-sm:w-[140%]" />
        {/* Dark overlay for readable text */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-r from-[#030B14]/95 via-[#071426]/70 to-[#071426]/25" />
        <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${C.accent}55, transparent)` }} />
      </div>

      <AnimatedHeroText />
    </section>
  )
}
