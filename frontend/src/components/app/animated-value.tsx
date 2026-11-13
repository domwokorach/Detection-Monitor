import { useEffect, useRef, useState } from 'react'
import { animate, useReducedMotion } from 'motion/react'

/** Eases from the value currently on screen to the new one (650ms ease-out). Only runs when the value changes; `changed` pulses for ~900ms. */
export function useCountUp(value: number, duration = 0.65) {
  const reduced = useReducedMotion()
  const shown = useRef(0), last = useRef<number | null>(null)
  const [, tick] = useState(0)
  const [changed, setChanged] = useState(false)
  useEffect(() => {
    if (last.current === value && shown.current === value) return // StrictMode re-runs the effect after cleanup stopped the tween
    const first = last.current === null
    last.current = value
    let timer: number | undefined
    if (!first) { setChanged(true); timer = window.setTimeout(() => setChanged(false), 900) }
    if (reduced) { shown.current = value; tick(n => n + 1); return () => window.clearTimeout(timer) }
    const c = animate(shown.current, value, { duration, ease: 'easeOut', onUpdate: v => { shown.current = v; tick(n => n + 1) }, onComplete: () => { shown.current = value; tick(n => n + 1) } })
    return () => { c.stop(); window.clearTimeout(timer) }
  }, [value, reduced, duration])
  return { shown: shown.current, changed }
}

export function AnimatedValue({ value, format, className }: { value: number; format: (n: number) => string; className?: string }) {
  const { shown } = useCountUp(value)
  return <span className={className} aria-label={format(value)}><span aria-hidden="true" className="tech tabular-nums">{format(shown)}</span></span>
}
