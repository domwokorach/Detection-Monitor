<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { motion } from 'motion-v'
import { SearchCheck, ArrowDownUp } from 'lucide-vue-next'
import { data, focusAlertId, status } from '@/stores/app'
import { relative, money } from '@/lib/format'
import Select from '@/components/ui/Select.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import RiskBadge from '@/components/ui/RiskBadge.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import AlertCase from '@/components/AlertCase.vue'

const statusFilter = ref('active')
const sortKey = ref('risk')
const selected = ref<string>('')

const statusOptions = [{ value: 'active', label: 'Active cases' }, { value: 'OPEN', label: 'Open' }, { value: 'IN_REVIEW', label: 'In review' }, { value: 'ESCALATED', label: 'Escalated' }, { value: 'CLOSED', label: 'Closed' }, { value: 'all', label: 'All cases' }]
const sortOptions = [{ value: 'risk', label: 'Highest risk' }, { value: 'newest', label: 'Newest' }, { value: 'oldest', label: 'Oldest (SLA)' }, { value: 'amount', label: 'Largest amount' }]

const queue = computed(() => {
  const rows = data.alerts.filter(a => statusFilter.value === 'all' || (statusFilter.value === 'active' ? a.status !== 'CLOSED' : a.status === statusFilter.value))
  const by: Record<string, (a: typeof rows[number]) => number> = {
    risk: a => -a.risk_score, newest: a => -+new Date(a.created_at), oldest: a => +new Date(a.created_at), amount: a => -Number(a.transaction.amount),
  }
  return [...rows].sort((x, y) => by[sortKey.value](x) - by[sortKey.value](y))
})

// Deep link from other pages (openAlert) wins; otherwise default to the top of the queue.
watch([() => focusAlertId.value, queue], () => {
  if (focusAlertId.value && data.alerts.some(a => a.id === focusAlertId.value)) {
    if (!queue.value.some(a => a.id === focusAlertId.value)) statusFilter.value = 'all'
    selected.value = focusAlertId.value
    focusAlertId.value = null
  } else if (!queue.value.some(a => a.id === selected.value)) selected.value = queue.value[0]?.id ?? ''
}, { immediate: true })
const loading = computed(() => !status.loaded && !status.error)
</script>

<template>
  <div class="grid gap-5 lg:grid-cols-[minmax(18rem,24rem)_1fr]">
    <section class="glass flex max-h-[calc(100vh-7rem)] flex-col rounded-2xl p-4" aria-label="Investigation queue">
      <div class="mb-3 grid grid-cols-2 gap-2">
        <Select v-model="statusFilter" :options="statusOptions" label="Filter cases by status" />
        <Select v-model="sortKey" :options="sortOptions" label="Sort cases" />
      </div>
      <p class="mb-2 flex items-center gap-1.5 text-xs text-slate-400"><ArrowDownUp :size="12" aria-hidden="true" />{{ queue.length }} case{{ queue.length === 1 ? '' : 's' }}</p>
      <div v-if="loading" class="space-y-2"><Skeleton v-for="n in 6" :key="n" class="h-16" /></div>
      <EmptyState v-else-if="!queue.length" :icon="SearchCheck" title="Queue is empty" body="No cases match this view." />
      <ul v-else class="-mx-1 flex-1 space-y-1.5 overflow-y-auto px-1">
        <li v-for="(a, i) in queue" :key="a.id">
          <motion.button type="button" :initial="{ opacity: 0, x: -8 }" :animate="{ opacity: 1, x: 0 }" :transition="{ duration: 0.18, delay: Math.min(i, 10) * 0.02 }"
            class="focus-ring w-full rounded-xl border p-3 text-left transition-colors"
            :class="selected === a.id ? 'border-violet-400/50 bg-violet-500/15' : 'border-transparent hover:bg-white/5'" :aria-current="selected === a.id ? 'true' : undefined" @click="selected = a.id">
            <span class="flex items-center justify-between gap-2"><span class="truncate text-sm font-medium text-white">{{ a.transaction.counterparty }}</span><RiskBadge :score="a.risk_score" :show-score="false" /></span>
            <span class="mt-1 flex items-center justify-between gap-2 text-xs text-slate-400"><span class="tabular-nums">{{ money(a.transaction.amount, a.transaction.currency) }} · {{ relative(a.created_at) }}</span><StatusBadge :status="a.status" /></span>
          </motion.button>
        </li>
      </ul>
    </section>

    <section aria-label="Case details" class="min-w-0">
      <EmptyState v-if="!selected" :icon="SearchCheck" title="Select a case" body="Choose an alert from the queue to review its evidence and take action." />
      <AlertCase v-else :alert-id="selected" />
    </section>
  </div>
</template>
