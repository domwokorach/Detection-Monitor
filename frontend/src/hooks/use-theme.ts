import { useEffect, useSyncExternalStore } from 'react'

export type ThemeMode = 'dark' | 'light' | 'system'
const KEY = 'detection-monitor.theme'
const query = window.matchMedia('(prefers-color-scheme: light)')

/** Dark is the default on first visit; only an explicit choice is stored. */
function read(): ThemeMode {
  try { const v = localStorage.getItem(KEY); if (v === 'dark' || v === 'light' || v === 'system') return v } catch { /* storage blocked */ }
  return 'dark'
}
let mode = read()
const listeners = new Set<() => void>()
const resolve = (m: ThemeMode): 'dark' | 'light' => (m === 'system' ? (query.matches ? 'light' : 'dark') : m)

function apply() {
  const t = resolve(mode)
  document.documentElement.classList.toggle('dark', t === 'dark')
  document.documentElement.style.colorScheme = t
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#020D1B' : '#E9F0F7')
}
export function setThemeMode(next: ThemeMode) {
  mode = next
  try { localStorage.setItem(KEY, next) } catch { /* preference lasts for this session only */ }
  apply(); listeners.forEach(l => l())
}
query.addEventListener('change', () => { if (mode === 'system') { apply(); listeners.forEach(l => l()) } })
apply()

export function useTheme() {
  const m = useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb) }, () => mode)
  useEffect(() => { apply() }, [m])
  return { mode: m, resolved: resolve(m), setMode: setThemeMode }
}
