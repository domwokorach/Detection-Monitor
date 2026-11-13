<script setup lang="ts">
import { computed } from 'vue'
import { motion } from 'motion-v'
import { TooltipRoot, TooltipTrigger, TooltipPortal, TooltipContent } from 'reka-ui'
import {
  House, BellRing, ArrowLeftRight, Users, Gauge, ListChecks, SearchCheck, BriefcaseBusiness, FileText,
  ShieldCheck, Settings, PanelLeftClose, PanelLeftOpen,
} from 'lucide-vue-next'
import DetectionMonitorLogo from '@/components/brand/DetectionMonitorLogo.vue'
import { data, navigate, page } from '@/stores/app'
import { NAV_PAGES } from '@/lib/nav'
import type { Page } from '@/types'

defineProps<{ mobileOpen: boolean }>()
const emit = defineEmits<{ 'close-mobile': [] }>()
const collapsed = defineModel<boolean>('collapsed', { required: true })

const openAlerts = computed(() => data.overview?.open_alerts ?? 0)
const icons = { overview: House, alerts: BellRing, transactions: ArrowLeftRight, customers: Users, rules: Gauge, watchlists: ListChecks,
  workspace: SearchCheck, cases: BriefcaseBusiness, reports: FileText, audit: ShieldCheck, settings: Settings } as Record<Page, typeof House>
const go = (id: Page) => { navigate(id); emit('close-mobile') }
</script>

<template>
  <div v-if="mobileOpen" class="fixed inset-0 z-30 bg-ink-950/70 lg:hidden" @click="emit('close-mobile')" />
  <motion.aside
    :animate="{ width: collapsed ? 60 : 220 }" :initial="false" :transition="{ duration: 0.25, ease: 'easeInOut' }"
    class="fixed inset-y-0 left-0 z-40 flex flex-col border-r border-line bg-ink-850 transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0"
    :class="mobileOpen ? 'translate-x-0' : '-translate-x-full'" aria-label="Primary"
  >
    <div class="flex h-14 items-center overflow-hidden" :class="collapsed ? 'justify-center px-2' : 'px-4'">
      <DetectionMonitorLogo :collapsed="collapsed" @navigate="emit('close-mobile')" />
    </div>

    <nav class="mt-3 flex-1 space-y-0.5 overflow-y-auto px-2.5" aria-label="Main navigation">
      <TooltipRoot v-for="item in NAV_PAGES" :key="item.id" :disabled="!collapsed" :delay-duration="100">
        <TooltipTrigger as-child>
          <button
            class="focus-ring group relative flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-[12.5px] font-medium transition-colors duration-200"
            :class="page === item.id ? 'text-hl' : 'text-fg2 hover:bg-white/[0.04] hover:text-fg'"
            :aria-current="page === item.id ? 'page' : undefined" @click="go(item.id)"
          >
            <motion.span v-if="page === item.id" layout-id="nav-active" class="absolute inset-0 rounded-md border border-accent/30 bg-accent/10 shadow-[0_0_16px_-4px_rgb(101_185_238/0.35)]"
              :transition="{ duration: 0.25, ease: 'easeOut' }" />
            <component :is="icons[item.id]" :size="16" :stroke-width="1.75" class="relative shrink-0" aria-hidden="true" />
            <span v-if="!collapsed" class="relative truncate">{{ item.label }}</span>
            <span v-if="item.id === 'alerts' && openAlerts" class="relative ml-auto rounded-full bg-accent/15 px-1.5 py-px text-[10px] font-semibold tnum text-hl" :class="collapsed && 'absolute top-0.5 right-0.5 ml-0'">
              {{ openAlerts }}<span class="sr-only"> open alerts</span>
            </span>
          </button>
        </TooltipTrigger>
        <TooltipPortal>
          <TooltipContent side="right" :side-offset="10" class="z-[60] rounded-md border border-line bg-ink-700 px-2 py-1 text-xs text-fg">{{ item.label }}</TooltipContent>
        </TooltipPortal>
      </TooltipRoot>
    </nav>

    <div class="space-y-2 p-2.5">
      <div v-if="!collapsed" class="rounded-lg border border-line bg-ink-800 p-3">
        <p class="flex items-center gap-2 text-xs font-medium text-fg"><span class="size-1.5 rounded-full bg-ok shadow-[0_0_8px] shadow-ok" aria-hidden="true" /> Analyst assistant</p>
        <p class="mt-1.5 text-[11px] leading-snug text-fg3">Rule-engine explanations appear in AI Risk Intelligence on the dashboard.</p>
      </div>
      <button class="focus-ring hidden h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-[12.5px] text-fg2 hover:bg-white/[0.04] hover:text-fg lg:flex"
        :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'" :aria-expanded="!collapsed" @click="collapsed = !collapsed">
        <component :is="collapsed ? PanelLeftOpen : PanelLeftClose" :size="16" aria-hidden="true" />
        <span v-if="!collapsed">Collapse</span>
      </button>
    </div>
  </motion.aside>
</template>
