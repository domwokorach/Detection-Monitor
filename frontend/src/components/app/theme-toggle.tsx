import { Switch as SwitchPrimitive } from '@base-ui/react/switch'
import { motion, useReducedMotion, type HTMLMotionProps } from 'motion/react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'

const TRAVEL = 24 // track 52 − borders 2 − thumb 20 − 2×3 padding

/**
 * Animated dark / light switch. Built on the Base UI switch (as PaceUI's Motion Switch is) with a spring-driven thumb
 * that carries the Moon/Sun icon. Checked = dark mode. The thumb never overshoots: the spring is critically damped.
 */
export function ThemeToggle() {
  const { resolved, setMode } = useTheme()
  const reduced = useReducedMotion()
  const dark = resolved === 'dark'
  const spring = reduced ? { duration: 0 } : { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.9 }
  const icon = reduced ? { duration: 0 } : { duration: 0.25, ease: 'easeOut' as const }
  return (
    <SwitchPrimitive.Root checked={dark} onCheckedChange={c => setMode(c ? 'dark' : 'light')} aria-label="Dark mode" title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="relative inline-flex h-[26px] w-[52px] shrink-0 items-center rounded-full border border-border bg-secondary outline-none transition-[background-color,border-color,box-shadow] duration-300 after:absolute after:-inset-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none data-checked:border-primary/50 data-checked:bg-[#0B1E33] data-checked:shadow-[0_0_12px_-2px_rgba(101,185,238,0.45)]">
      <SwitchPrimitive.Thumb render={(props, state) => (
        <motion.span {...(props as unknown as HTMLMotionProps<'span'>)} initial={false} animate={{ x: state.checked ? TRAVEL : 0 }} transition={spring}
          className="absolute left-[3px] grid size-5 place-items-center rounded-full bg-white text-[#B35F12] shadow-sm ring-1 ring-black/5 data-checked:bg-primary data-checked:text-[#030B14] data-checked:ring-0">
          <motion.span className="absolute grid place-items-center" initial={false} animate={{ opacity: state.checked ? 0 : 1, rotate: state.checked ? 70 : 0, scale: state.checked ? 0.5 : 1 }} transition={icon}><Sun className="size-3" aria-hidden="true" /></motion.span>
          <motion.span className="absolute grid place-items-center" initial={false} animate={{ opacity: state.checked ? 1 : 0, rotate: state.checked ? 0 : -70, scale: state.checked ? 1 : 0.5 }} transition={icon}><Moon className="size-3" aria-hidden="true" /></motion.span>
        </motion.span>
      )} />
    </SwitchPrimitive.Root>
  )
}
