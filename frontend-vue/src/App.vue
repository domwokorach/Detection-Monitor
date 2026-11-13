<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { AnimatePresence, MotionConfig, motion } from 'motion-v'
import { TooltipProvider } from 'reka-ui'
import { CalendarDays, FlaskConical } from 'lucide-vue-next'
import { demo, logout, page, rangeDays, user } from '@/stores/app'
import Sidebar from '@/components/layout/Sidebar.vue'
import Topbar from '@/components/layout/Topbar.vue'
import GlobalSearch from '@/components/layout/GlobalSearch.vue'
import Select from '@/components/ui/Select.vue'
import Toaster from '@/components/ui/Toaster.vue'
import Login from '@/pages/Login.vue'
import Overview from '@/pages/Overview.vue'
import Transactions from '@/pages/Transactions.vue'
import Alerts from '@/pages/Alerts.vue'
import Rules from '@/pages/Rules.vue'
import Workspace from '@/pages/Workspace.vue'
import Audit from '@/pages/Audit.vue'
import Placeholder from '@/pages/Placeholder.vue'
import type { Page } from '@/types'

const views: Partial<Record<Page, unknown>> = { overview: Overview, transactions: Transactions, alerts: Alerts, rules: Rules, workspace: Workspace, audit: Audit }
const titles: Record<Page, [string, string]> = {
  overview: ['AML Command Center', 'Real-time monitoring of suspicious banking transactions across the United Kingdom.'],
  transactions: ['Transaction monitoring', 'Search, filter and inspect every payment'],
  alerts: ['Alerts', 'Prioritised alerts awaiting a decision'], rules: ['Risk scoring', 'Configure how transactions are scored'],
  workspace: ['Investigations', 'Investigate cases end to end'], audit: ['Compliance', 'Tamper-evident audit history: who changed what, and when'],
  customers: ['Customers', ''], watchlists: ['Watchlists', ''], cases: ['Cases', ''], reports: ['Reports', ''], settings: ['Settings', ''],
}
const collapsed = ref(false)
const mobileOpen = ref(false)
const current = computed(() => views[page.value] ?? Placeholder)
const range = computed({ get: () => String(rangeDays.value), set: v => { rangeDays.value = v === '14' ? 14 : 7 } })
watch(page, () => { document.title = `${titles[page.value][0]} · Detection-monitor`; window.scrollTo({ top: 0 }) }, { immediate: true })
</script>

<template>
  <!-- reduced-motion="user" makes every motion-v animation honour prefers-reduced-motion -->
  <MotionConfig reduced-motion="user">
    <TooltipProvider>
      <Login v-if="!user" />
      <div v-else class="flex min-h-screen">
        <a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[80] focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-ink-950">Skip to content</a>
        <Sidebar v-model:collapsed="collapsed" :mobile-open="mobileOpen" @close-mobile="mobileOpen = false" />
        <div class="min-w-0 flex-1 bg-ink-900">
          <Topbar @open-menu="mobileOpen = true" />
          <div v-if="demo" class="flex items-center justify-center gap-2 border-b border-sev-med/20 bg-sev-med/10 px-4 py-1 text-[11px] text-sev-med" role="status">
            <FlaskConical :size="12" aria-hidden="true" /> <strong>Demo data</strong> — simulated, stored in memory only.
            <button class="focus-ring rounded underline underline-offset-2 hover:text-fg" @click="logout">Exit demo</button>
          </div>
          <main id="main" tabindex="-1" class="mx-auto max-w-[1560px] px-4 py-5 outline-none lg:px-6">
            <AnimatePresence mode="wait">
              <motion.div :key="page" :initial="{ opacity: 0, y: 8 }" :animate="{ opacity: 1, y: 0 }" :exit="{ opacity: 0, y: -4 }" :transition="{ duration: 0.2 }">
                <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div class="min-w-0"><h1 class="text-xl font-semibold tracking-tight text-fg">{{ titles[page][0] }}</h1><p v-if="titles[page][1]" class="mt-0.5 text-[11px] text-fg2">{{ titles[page][1] }}</p></div>
                  <div class="flex flex-wrap items-center gap-2">
                    <GlobalSearch />
                    <div v-if="page === 'overview'" class="flex items-center gap-1.5">
                      <CalendarDays :size="14" class="text-fg3" aria-hidden="true" />
                      <Select v-model="range" label="Date range" :options="[{ value: '7', label: 'Last 7 days' }, { value: '14', label: 'Last 14 days' }]" />
                    </div>
                  </div>
                </div>
                <component :is="current" />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
      <Toaster />
    </TooltipProvider>
  </MotionConfig>
</template>
