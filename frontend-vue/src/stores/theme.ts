import { computed, ref, watchEffect } from 'vue'

export type ThemeMode = 'dark' | 'light' | 'system'
const KEY = 'detection-monitor.theme'
const THEME_COLOR = { dark: '#020D1B', light: '#E9F0F7' }

/** Dark is the default on the first visit; only an explicit choice is stored. */
function read(): ThemeMode {
  try { const v = localStorage.getItem(KEY); if (v === 'dark' || v === 'light' || v === 'system') return v } catch { /* storage blocked */ }
  return 'dark'
}

export const themeMode = ref<ThemeMode>(read())
const query = window.matchMedia('(prefers-color-scheme: light)')
const systemLight = ref(query.matches)
query.addEventListener('change', e => { systemLight.value = e.matches })

export const resolvedTheme = computed<'dark' | 'light'>(() =>
  themeMode.value === 'system' ? (systemLight.value ? 'light' : 'dark') : themeMode.value)

watchEffect(() => {
  const t = resolvedTheme.value, root = document.documentElement
  root.dataset.theme = t
  root.classList.toggle('dark', t === 'dark')
  root.style.colorScheme = t
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[t])
})

export function setThemeMode(mode: ThemeMode) {
  themeMode.value = mode
  try { localStorage.setItem(KEY, mode) } catch { /* storage blocked: preference lasts for this session */ }
}
