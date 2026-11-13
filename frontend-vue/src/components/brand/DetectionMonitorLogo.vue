<script setup lang="ts">
import { useId } from 'vue'
import { navigate } from '@/stores/app'

/**
 * Shield + padlock logo lockup (pure SVG geometry, transparent background) linking to the dashboard.
 * Hash-routed app: `#/dashboard` resolves to the Overview page.
 */
withDefaults(defineProps<{
  size?: number
  showName?: boolean
  showCaption?: boolean
  /** Fade the wordmark out when the sidebar is collapsed. */
  collapsed?: boolean
}>(), { size: 36, showName: true, showCaption: true, collapsed: false })
const emit = defineEmits<{ navigate: [] }>()
const gid = useId()
const go = (e: MouseEvent) => { e.preventDefault(); navigate('overview'); emit('navigate') }
</script>

<template>
  <a href="#/dashboard" aria-label="Detection-monitor — Dashboard" class="dm-logo focus-ring group/logo flex min-w-0 items-center rounded-[5px]" @click="go">
    <svg viewBox="0 0 100 100" :width="size" :height="size" fill="none" aria-hidden="true" focusable="false"
      class="dm-mark shrink-0 transition-[filter,width,height] duration-200 ease-out" :style="collapsed ? { width: '32px', height: '32px' } : undefined">
      <defs>
        <linearGradient :id="gid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#65B9EE" /><stop offset="1" stop-color="#38BDF8" /></linearGradient>
      </defs>
      <path fill="#38BDF8" d="M50 3.2C40 9.5 24 16 10.5 19.3c-1.6.4-2.6 1.2-2.6 3.2V43c0 20 14 40 39.4 53.7 1.7.9 3.7.9 5.4 0C78.1 83 92.1 63 92.1 43V22.5c0-2-1-2.8-2.6-3.2C76 16 60 9.5 50 3.2Z" />
      <path fill="#071426" d="M50 9.5c-11.5 7-23 11.5-34.8 14.8V43c0 17.5 12.5 35 34.8 48C72.3 78 84.8 60.5 84.8 43V24.3C73 21 61.5 16.5 50 9.5Z" />
      <path :stroke="`url(#${gid})`" stroke-width="4.4" d="M39.05 42V37.2a10.95 10.95 0 0 1 21.9 0V42" />
      <rect x="31.7" y="41.5" width="36.2" height="27.4" rx="4.5" :fill="`url(#${gid})`" />
      <circle cx="50" cy="52.4" r="4.5" fill="#071426" />
      <path fill="#071426" d="M47.5 55.5 46.9 62.4q0 .9.9.9h4.4q.9 0 .9-.9L52.5 55.5Z" />
    </svg>
    <span v-if="showName" aria-hidden="true" class="dm-name ml-3 flex min-w-0 flex-col overflow-hidden leading-tight" :class="collapsed && 'dm-name-hidden'">
      <span class="truncate text-base font-semibold tracking-[-0.3px] text-fg" style="font-family: 'Geist', 'Inter', ui-sans-serif, system-ui, sans-serif">Detection-monitor</span>
      <span v-if="showCaption" class="dm-caption truncate text-[11px]" style="font-family: 'Geist', 'Inter', ui-sans-serif, system-ui, sans-serif">Financial Intelligence Platform</span>
    </span>
  </a>
</template>

<style scoped>
.dm-name { max-width: 200px; opacity: 1; transition: max-width 200ms ease-in-out, margin 200ms ease-in-out, opacity 150ms ease-out; }
.dm-name-hidden { max-width: 0; margin-left: 0; opacity: 0; }
.dm-caption { color: var(--color-fg3); }
:global(html.dark) .dm-caption { color: #8CA2BA; }
.dm-logo:hover .dm-mark, .dm-logo:focus-visible .dm-mark { filter: drop-shadow(0 0 7px rgb(56 189 248 / 0.55)); }
@media (prefers-reduced-motion: reduce) { .dm-mark, .dm-name { transition: none; } }
</style>
