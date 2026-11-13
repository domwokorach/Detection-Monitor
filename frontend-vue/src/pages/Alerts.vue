<script setup lang="ts">
import { computed, ref } from 'vue'
import { motion, AnimatePresence } from 'motion-v'
import { TabsRoot, TabsList, TabsTrigger } from 'reka-ui'
import { BellOff, UserRound } from 'lucide-vue-next'
import { data, refresh, status, user } from '@/stores/app'
import { relative, money } from '@/lib/format'
import Skeleton from '@/components/ui/Skeleton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import RiskBadge from '@/components/ui/RiskBadge.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import Drawer from '@/components/ui/Drawer.vue'
import AlertCase from '@/components/AlertCase.vue'

const filter = ref<'ACTIVE' | 'HIGH' | 'ESCALATED' | 'MINE' | 'CLOSED'>('ACTIVE')
const open = ref(false)
const selectedId = ref('')

const tabs = computed(() => [
  { v: 'ACTIVE', l: 'Active', n: data.alerts.filter(a => a.status !== 'CLOSED').length },
  { v: 'HIGH', l: 'High priority', n: data.alerts.filter(a => a.status !== 'CLOSED' && a.priority === 'HIGH').length },
  { v: 'ESCALATED', l: 'Escalated', n: data.alerts.filter(a => a.status === 'ESCALATED').length },
  { v: 'MINE', l: 'Assigned to me', n: data.alerts.filter(a => a.assigned_to === user.value?.id && a.status !== 'CLOSED').length },
  { v: 'CLOSED', l: 'Closed', n: data.alerts.filter(a => a.status === 'CLOSED').length },
])
const shown = computed(() => data.alerts.filter(a => ({
  ACTIVE: a.status !== 'CLOSED', HIGH: a.status !== 'CLOSED' && a.priority === 'HIGH', ESCALATED: a.status === 'ESCALATED',
  MINE: a.assigned_to === user.value?.id && a.status !== 'CLOSED', CLOSED: a.status === 'CLOSED',
})[filter.value]))
const accent = { HIGH: 'from-rose-500', MEDIUM: 'from-amber-400', LOW: 'from-emerald-400' } as const
const loading = computed(() => !status.loaded && !status.error)
function openCase(id: string) { selectedId.value = id; open.value = true }
</script>

<template>
  <div class="space-y-5">
    <ErrorState v-if="status.error && !status.loaded" :message="status.error" @retry="refresh()" />
    <TabsRoot v-model="filter">
      <TabsList class="flex gap-1 overflow-x-auto rounded-xl border border-white/8 bg-white/5 p-1" aria-label="Alert filters">
        <TabsTrigger v-for="t in tabs" :key="t.v" :value="t.v" class="focus-ring relative flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm text-slate-400 data-[state=active]:text-white">
          <motion.span v-if="filter === t.v" layout-id="alert-tab" class="absolute inset-0 rounded-lg bg-white/10" :transition="{ type: 'spring', stiffness: 520, damping: 40 }" />
          <span class="relative">{{ t.l }}</span><span class="relative rounded-full bg-white/10 px-1.5 text-xs tabular-nums">{{ t.n }}</span>
        </TabsTrigger>
      </TabsList>
    </TabsRoot>

    <div v-if="loading" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><Skeleton v-for="n in 6" :key="n" class="h-44 !rounded-2xl" /></div>
    <EmptyState v-else-if="!shown.length" :icon="BellOff" title="No alerts here" body="Nothing in this view. Switch filters or check back after new transactions are screened." />
    <motion.ul v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-3" layout>
      <AnimatePresence mode="popLayout">
        <motion.li v-for="(a, i) in shown" :key="a.id" layout :initial="{ opacity: 0, y: 14, scale: 0.98 }" :animate="{ opacity: 1, y: 0, scale: 1 }" :exit="{ opacity: 0, scale: 0.96 }" :transition="{ duration: 0.24, delay: Math.min(i, 8) * 0.04 }">
          <motion.button type="button" :while-hover="{ y: -3 }" :while-press="{ scale: 0.985 }"
            class="glass focus-ring group relative block h-full w-full overflow-hidden rounded-2xl p-5 text-left transition-shadow hover:shadow-[0_0_0_1px_rgb(105_184_240/0.4),0_24px_50px_-22px_rgb(105_184_240/0.45)]"
            :aria-label="`Investigate ${a.priority.toLowerCase()} priority alert for ${a.transaction.counterparty}`" @click="openCase(a.id)">
            <span class="absolute inset-y-0 left-0 w-1 bg-gradient-to-b to-transparent" :class="accent[a.priority]" aria-hidden="true" />
            <div class="flex items-start justify-between gap-2">
              <span class="rounded-md border border-white/10 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-slate-300">{{ a.priority }} PRIORITY</span>
              <RiskBadge :score="a.risk_score" />
            </div>
            <p class="mt-3 truncate text-base font-semibold text-white">{{ a.transaction.counterparty }}</p>
            <p class="mt-0.5 text-sm text-slate-300 tabular-nums">{{ money(a.transaction.amount, a.transaction.currency) }} · {{ a.transaction.country }}</p>
            <div class="mt-4 flex items-center justify-between text-xs text-slate-400">
              <StatusBadge :status="a.status" />
              <span class="flex items-center gap-1.5"><UserRound :size="12" aria-hidden="true" />{{ a.assigned_to ? (a.assigned_to === user?.id ? 'You' : 'Assigned') : 'Unassigned' }} · {{ relative(a.created_at) }}</span>
            </div>
          </motion.button>
        </motion.li>
      </AnimatePresence>
    </motion.ul>

    <Drawer v-model:open="open" title="Alert investigation" description="Review evidence, assign, escalate or resolve">
      <AlertCase v-if="selectedId" :alert-id="selectedId" />
    </Drawer>
  </div>
</template>
