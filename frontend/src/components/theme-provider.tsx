import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type ThemeMode = 'dark' | 'light' | 'system'
type Theme = { mode: ThemeMode; resolved: 'dark' | 'light'; setMode: (m: ThemeMode) => void }

const KEY = 'detection-monitor.theme'
const THEME_COLOR = { dark: '#030B14', light: '#F4F8FC' }
const Ctx = createContext<Theme | null>(null)

/** Dark is the default on first visit; only an explicit choice is stored. index.html applies it before first paint. */
function read(): ThemeMode {
  try { const v = localStorage.getItem(KEY); if (v === 'dark' || v === 'light' || v === 'system') return v } catch { /* storage blocked */ }
  return 'dark'
}
const systemTheme = (): 'dark' | 'light' => (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
const resolve = (m: ThemeMode) => (m === 'system' ? systemTheme() : m)

function apply(t: 'dark' | 'light') {
  const root = document.documentElement
  root.classList.toggle('dark', t === 'dark')
  root.style.colorScheme = t
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[t])
}

/** Single source of truth for the theme: every consumer reads this context instead of keeping its own state. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(read)
  const [system, setSystem] = useState(systemTheme)
  const resolved = mode === 'system' ? system : mode

  useEffect(() => { apply(resolved) }, [resolved])
  useEffect(() => {
    const q = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => setSystem(q.matches ? 'light' : 'dark')
    q.addEventListener('change', onChange)
    return () => q.removeEventListener('change', onChange)
  }, [])
  // Keep other open tabs in step with a change made here.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) setModeState(read()) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setMode = useCallback((next: ThemeMode) => {
    // Brief, scoped colour transition (not left on permanently, so normal interactions stay snappy).
    const root = document.documentElement
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && resolve(next) !== document.documentElement.style.colorScheme) {
      root.classList.add('theme-transition')
      window.setTimeout(() => root.classList.remove('theme-transition'), 350)
    }
    setModeState(next)
    try { localStorage.setItem(KEY, next) } catch { /* preference lasts for this session only */ }
  }, [])

  const value = useMemo(() => ({ mode, resolved, setMode }), [mode, resolved, setMode])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTheme(): Theme {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTheme must be used inside <ThemeProvider>')
  return v
}
