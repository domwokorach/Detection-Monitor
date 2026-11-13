import { useCallback, useState } from 'react'
import { motion, stagger, useReducedMotion } from 'motion/react'
import { ShieldCheck } from 'lucide-react'
import { RevealText } from '@/components/ui/reveal-text'

const C = { accent: '#65B9EE', ice: '#BFE8FF', text: '#F2F7FC', muted: '#8CA2BA', border: '#1B344D' }
const EASE = 'easeOut' as const
const WORD_STAGGER = 0.085 // 70–100ms
const WORD_DURATION = 0.55 // 450–650ms
const START = 0.15

/* RevealText re-runs its effect when these change, so they must be stable module-level values. */
const KEYFRAMES = { opacity: [0, 1], y: [12, 0] }
const LINE_1 = { duration: WORD_DURATION, ease: EASE, delay: stagger(WORD_STAGGER, { startDelay: START }) }
const LINE_2 = { duration: WORD_DURATION, ease: EASE, delay: stagger(WORD_STAGGER, { startDelay: START + 2 * WORD_STAGGER }) }
const HEADLINE_END = START + 5 * WORD_STAGGER + WORD_DURATION // when the last word has settled

/** One headline line revealed word by word. Hidden until split so the full line never flashes first. */
function Line({ children, color, options }: { children: string; color: string; options: typeof LINE_1 }) {
  const [ready, setReady] = useState(false)
  const onSetup = useCallback((words: HTMLElement[]) => { words.forEach(w => { w.style.opacity = '0' }); setReady(true) }, [])
  return (
    <RevealText type="words" motionKeyframes={KEYFRAMES} motionOptions={options} onSetup={onSetup} aria-hidden="true"
      className={ready ? 'block' : 'invisible block'} style={{ color }}>{children}</RevealText>
  )
}

/**
 * Hero copy for the sign-in page. Sequence: headline word by word, then the description fades in, then the capability chips.
 * Plays once on mount. Under prefers-reduced-motion everything renders immediately. The chips are product capability
 * labels, not a backend connection state.
 */
export function AnimatedHeroText() {
  const reduced = useReducedMotion()
  const fade = (delay: number) => (reduced
    ? { initial: false as const }
    : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, ease: EASE, delay } })
  return (
    <div className="relative w-full px-6 py-10 sm:px-10 lg:px-14 xl:px-20">
      <motion.h1 {...fade(0)} className="text-[30px] font-bold tracking-[-0.035em]" style={{ color: C.text }}>Detection Monitor</motion.h1>

      <h2 className="mt-8 text-4xl leading-[1.08] font-semibold tracking-[-0.04em] sm:text-[44px] lg:text-[52px] xl:text-[60px]">
        <span className="sr-only">Catch detection before it settles.</span>
        {reduced ? (
          <span aria-hidden="true"><span className="block" style={{ color: C.text }}>Catch detection</span><span className="block" style={{ color: C.ice }}>before it settles.</span></span>
        ) : (
          <span aria-hidden="true" className="block">
            <Line color={C.text} options={LINE_1}>Catch detection</Line>
            <Line color={C.ice} options={LINE_2}>before it settles.</Line>
          </span>
        )}
      </h2>

      <motion.p {...fade(HEADLINE_END - 0.1)} className="mt-5 max-w-md text-sm leading-7 sm:text-[15px]" style={{ color: C.muted }}>
        Event-time rule screening, analyst case management and a tamper-evident audit trail in one workspace.
      </motion.p>

      <motion.ul {...fade(HEADLINE_END + 0.25)} className="mt-7 flex flex-wrap items-center gap-2 text-xs" aria-label="Capabilities">
        <li className="group flex items-center gap-2 rounded-[5px] border px-3 py-1.5 transition-colors duration-300 hover:bg-[#0B1E33]" style={{ borderColor: C.border, color: C.ice }}>
          <span aria-hidden="true" className="size-1.5 rounded-full transition-shadow duration-300 group-hover:shadow-[0_0_10px_2px_rgba(101,185,238,0.7)]" style={{ background: C.accent, boxShadow: '0 0 6px rgba(101,185,238,0.55)' }} />
          <span className="font-medium">Live screening</span>
        </li>
        <li aria-hidden="true" style={{ color: C.border }}>·</li>
        <li className="group flex items-center gap-2 rounded-[5px] border px-3 py-1.5 transition-colors duration-300 hover:bg-[#0B1E33]" style={{ borderColor: C.border, color: C.muted }}>
          <ShieldCheck aria-hidden="true" className="size-3.5 transition-colors duration-300 group-hover:text-[#BFE8FF]" style={{ color: C.ice, opacity: 0.8 }} />
          <span className="font-medium transition-colors duration-300 group-hover:text-[#BFE8FF]">Audit-ready</span>
        </li>
      </motion.ul>
    </div>
  )
}
