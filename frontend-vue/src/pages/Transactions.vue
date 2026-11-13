<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { Search, SlidersHorizontal, ArrowDownUp, ChevronLeft, ChevronRight, FilterX, ReceiptText, Landmark } from 'lucide-vue-next'
import { connectBank, data, demo, globalSearch, isAdmin, refresh, status } from '@/stores/app'
import { riskLevel } from '@/lib/risk'
import { dateTime, money } from '@/lib/format'
import { inputCls } from '@/lib/ui'
import Panel from '@/components/ui/Panel.vue'
import RiskBadge from '@/components/ui/RiskBadge.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Select from '@/components/ui/Select.vue'
import Btn from '@/components/ui/Btn.vue'
import TransactionDrawer from '@/components/TransactionDrawer.vue'
import type { Transaction } from '@/types'

const PAGE_SIZE = 20
const f = reactive({ from: '', to: '', min: '', max: '', country: 'all', risk: 'all', status: 'all' })
const sort = ref<{ key: 'occurred_at' | 'amount' | 'risk_score'; dir: 1 | -1 }>({ key: 'occurred_at', dir: -1 })
const pageNo = ref(1)
const showFilters = ref(true)
const drawer = ref(false)
const selected = ref<Transaction | null>(null)

const accountName = (id: string) => data.accounts.find(a => a.id === id)?.holder_name ?? id
const countries = computed(() => [{ value: 'all', label: 'All countries' }, ...[...new Set(data.transactions.map(t => t.country))].sort().map(c => ({ value: c, label: c }))])
const riskOptions = [{ value: 'all', label: 'Any risk' }, { value: 'low', label: '● Low' }, { value: 'medium', label: '▲ Medium' }, { value: 'high', label: '◆ High' }, { value: 'critical', label: '⬢ Critical' }]
const statusOptions = [{ value: 'all', label: 'Any status' }, { value: 'SCREENED', label: 'Screened' }, { value: 'PENDING', label: 'Pending' }, { value: 'FAILED', label: 'Failed' }]

const filtered = computed(() => {
  const q = globalSearch.value.trim().toLowerCase()
  const from = f.from ? new Date(f.from + 'T00:00:00').getTime() : -Infinity
  const to = f.to ? new Date(f.to + 'T23:59:59').getTime() : Infinity
  const min = f.min === '' ? -Infinity : Number(f.min)
  const max = f.max === '' ? Infinity : Number(f.max)
  const rows = data.transactions.filter(t => {
    const when = +new Date(t.occurred_at), amt = Number(t.amount)
    return when >= from && when <= to && amt >= min && amt <= max
      && (f.country === 'all' || t.country === f.country)
      && (f.risk === 'all' || riskLevel(t.risk_score) === f.risk)
      && (f.status === 'all' || t.screening_status === f.status)
      && (!q || `${t.external_id} ${t.counterparty} ${t.country} ${accountName(t.account_id)}`.toLowerCase().includes(q))
  })
  const { key, dir } = sort.value
  const value = (t: Transaction) => key === 'amount' ? Number(t.amount) : key === 'risk_score' ? t.risk_score : +new Date(t.occurred_at)
  return rows.sort((a, b) => (value(a) - value(b)) * dir)
})
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const visible = computed(() => filtered.value.slice((pageNo.value - 1) * PAGE_SIZE, pageNo.value * PAGE_SIZE))
const activeFilters = computed(() => Object.entries(f).some(([k, v]) => v !== '' && v !== 'all' && k) || !!globalSearch.value)
watch([filtered, pages], () => { if (pageNo.value > pages.value) pageNo.value = pages.value })
watch(() => [f.from, f.to, f.min, f.max, f.country, f.risk, f.status, globalSearch.value], () => { pageNo.value = 1 })

function clear() { Object.assign(f, { from: '', to: '', min: '', max: '', country: 'all', risk: 'all', status: 'all' }); globalSearch.value = '' }
function sortBy(key: typeof sort.value.key) { sort.value = { key, dir: sort.value.key === key ? (sort.value.dir === 1 ? -1 : 1) : -1 } }
const ariaSort = (key: string) => sort.value.key === key ? (sort.value.dir === 1 ? 'ascending' : 'descending') : 'none'

// Rows that arrive between polls glow briefly so analysts notice live activity.
const fresh = ref(new Set<string>())
let known: Set<string> | null = null
watch(() => data.transactions, rows => {
  const ids = new Set(rows.map(r => r.id))
  if (known) {
    const added = rows.filter(r => !known!.has(r.id)).map(r => r.id)
    if (added.length) { added.forEach(i => fresh.value.add(i)); setTimeout(() => added.forEach(i => fresh.value.delete(i)), 5000) }
  }
  known = ids
}, { immediate: true })

const loading = computed(() => !status.loaded && !status.error)
</script>

<template>
  <div class="space-y-5">
    <ErrorState v-if="status.error && !status.loaded" :message="status.error" @retry="refresh()" />
    <Panel title="Transactions" :subtitle="`${filtered.length.toLocaleString()} of ${data.transactions.length.toLocaleString()} transactions`">
      <template #actions>
        <div class="flex items-center gap-2">
          <Btn v-if="isAdmin && !demo" size="sm" variant="primary" @click="connectBank"><Landmark :size="14" /> Connect test bank</Btn>
          <Btn size="sm" variant="ghost" :disabled="!activeFilters" @click="clear"><FilterX :size="14" /> Clear</Btn>
          <Btn size="sm" :aria-expanded="showFilters" aria-controls="tx-filters" @click="showFilters = !showFilters"><SlidersHorizontal :size="14" /> Filters</Btn>
        </div>
      </template>

      <div class="relative mb-4">
        <Search :size="16" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-500" aria-hidden="true" />
        <input v-model="globalSearch" type="search" aria-label="Search transactions" placeholder="Search by reference, counterparty, country or account…" :class="[inputCls, 'pl-9']">
      </div>

      <AnimatePresence>
        <motion.div v-if="showFilters" id="tx-filters" :initial="{ height: 0, opacity: 0 }" :animate="{ height: 'auto', opacity: 1 }" :exit="{ height: 0, opacity: 0 }" :transition="{ duration: 0.22 }" class="overflow-hidden">
          <div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label class="space-y-1.5 text-xs text-slate-300">From date<input v-model="f.from" type="date" :class="inputCls"></label>
            <label class="space-y-1.5 text-xs text-slate-300">To date<input v-model="f.to" type="date" :class="inputCls"></label>
            <label class="space-y-1.5 text-xs text-slate-300">Min amount<input v-model="f.min" type="number" min="0" inputmode="decimal" placeholder="0" :class="inputCls"></label>
            <label class="space-y-1.5 text-xs text-slate-300">Max amount<input v-model="f.max" type="number" min="0" inputmode="decimal" placeholder="No limit" :class="inputCls"></label>
            <div class="space-y-1.5 text-xs text-slate-300"><span>Country</span><Select v-model="f.country" :options="countries" label="Country" /></div>
            <div class="space-y-1.5 text-xs text-slate-300"><span>Risk</span><Select v-model="f.risk" :options="riskOptions" label="Risk band" /></div>
            <div class="space-y-1.5 text-xs text-slate-300"><span>Status</span><Select v-model="f.status" :options="statusOptions" label="Screening status" /></div>
          </div>
        </motion.div>
      </AnimatePresence>

      <div v-if="loading" class="space-y-2" aria-busy="true" aria-label="Loading transactions"><Skeleton v-for="n in 8" :key="n" class="h-12" /></div>
      <EmptyState v-else-if="!filtered.length" :icon="ReceiptText" :title="data.transactions.length ? 'No transactions match these filters' : 'No transactions yet'"
        :body="data.transactions.length ? 'Try widening the date range or clearing filters.' : 'Transactions ingested through POST /api/transactions will appear here.'">
        <Btn v-if="activeFilters" size="sm" @click="clear">Clear filters</Btn>
      </EmptyState>
      <div v-else class="-mx-5 overflow-x-auto">
        <table class="w-full min-w-[820px] text-left text-sm">
          <caption class="sr-only">Transactions</caption>
          <thead class="text-xs text-slate-400">
            <tr class="border-b border-white/8">
              <th scope="col" class="px-5 py-2.5 font-medium">Counterparty</th>
              <th scope="col" class="px-3 py-2.5 font-medium">Account</th>
              <th v-for="c in [{ k: 'amount', l: 'Amount' }, { k: 'risk_score', l: 'Risk' }, { k: 'occurred_at', l: 'When' }] as const" :key="c.k" scope="col" class="px-3 py-2.5 font-medium" :aria-sort="ariaSort(c.k)">
                <button class="focus-ring inline-flex items-center gap-1 rounded hover:text-white" @click="sortBy(c.k)">{{ c.l }}<ArrowDownUp :size="12" aria-hidden="true" /></button>
              </th>
              <th scope="col" class="px-3 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            <motion.tr v-for="(t, i) in visible" :key="t.id" :initial="{ opacity: 0, y: 8 }" :animate="{ opacity: 1, y: 0 }" :transition="{ duration: 0.2, delay: Math.min(i, 10) * 0.025 }"
              class="cursor-pointer border-b border-white/5 transition-colors hover:bg-white/5 focus-within:bg-white/5" :class="fresh.has(t.id) && 'bg-cyan-400/10'" @click="selected = t; drawer = true">
              <td class="px-5 py-3">
                <button class="focus-ring rounded text-left" :aria-label="`View details for ${t.counterparty}`" @click.stop="selected = t; drawer = true">
                  <span class="block font-medium text-white">{{ t.counterparty }}<span v-if="fresh.has(t.id)" class="ml-2 rounded bg-cyan-400/20 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-200">NEW</span></span>
                  <span class="block font-mono text-xs text-slate-500">{{ t.external_id }} · {{ t.country }}</span>
                </button>
              </td>
              <td class="px-3 py-3 text-slate-300">{{ accountName(t.account_id) }}</td>
              <td class="px-3 py-3 text-slate-100 tabular-nums">{{ t.direction === 'CREDIT' ? '+' : '−' }}{{ money(t.amount, t.currency) }}</td>
              <td class="px-3 py-3"><RiskBadge :score="t.risk_score" /></td>
              <td class="px-3 py-3 whitespace-nowrap text-slate-400">{{ dateTime(t.occurred_at) }}</td>
              <td class="px-3 py-3"><StatusBadge :status="t.screening_status" /></td>
            </motion.tr>
          </tbody>
        </table>
      </div>

      <nav v-if="filtered.length > PAGE_SIZE" class="mt-4 flex items-center justify-between text-xs text-slate-400" aria-label="Pagination">
        <span>Page {{ pageNo }} of {{ pages }}</span>
        <div class="flex gap-2">
          <Btn size="sm" :disabled="pageNo <= 1" aria-label="Previous page" @click="pageNo--"><ChevronLeft :size="14" /></Btn>
          <Btn size="sm" :disabled="pageNo >= pages" aria-label="Next page" @click="pageNo++"><ChevronRight :size="14" /></Btn>
        </div>
      </nav>
    </Panel>
    <TransactionDrawer v-model:open="drawer" :tx="selected" />
  </div>
</template>
