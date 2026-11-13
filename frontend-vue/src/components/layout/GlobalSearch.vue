<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Search, X } from 'lucide-vue-next'
import { data, globalSearch, navigate, openAlert } from '@/stores/app'
import RiskBadge from '@/components/ui/RiskBadge.vue'

const focused = ref(false)
const input = ref<HTMLInputElement>()
const isMac = /Mac|iPhone|iPad/.test(navigator.platform)

const results = computed(() => {
  const q = globalSearch.value.trim().toLowerCase()
  if (q.length < 2) return []
  const accountName = (id: string) => data.accounts.find(a => a.id === id)?.holder_name ?? ''
  return data.transactions
    .filter(t => `${t.external_id} ${t.counterparty} ${t.country} ${accountName(t.account_id)}`.toLowerCase().includes(q))
    .slice(0, 6)
})
function pickResult(txId: string) {
  const alert = data.alerts.find(a => a.transaction_id === txId)
  globalSearch.value = ''; focused.value = false
  if (alert) openAlert(alert.id); else navigate('transactions')
}
function seeAll() { focused.value = false; navigate('transactions') }
const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.value?.focus() } }
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="relative w-full max-w-[360px]" @focusin="focused = true" @focusout="(e: FocusEvent) => { if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) focused = false }">
    <Search :size="14" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg3" aria-hidden="true" />
    <input ref="input" v-model="globalSearch" type="search" aria-label="Search transactions, customers and cases" placeholder="Search for transactions, customers, cases…"
      class="focus-ring h-9 w-full rounded-md border border-line bg-ink-800 pr-12 pl-8 text-xs text-fg transition-colors duration-200 placeholder:text-fg3 focus:border-accent/60 [&::-webkit-search-cancel-button]:hidden"
      @keydown.esc="globalSearch = ''; focused = false" @keydown.enter="seeAll">
    <button v-if="globalSearch" class="focus-ring absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-fg3 hover:text-fg" aria-label="Clear search" @click="globalSearch = ''"><X :size="13" /></button>
    <kbd v-else class="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[10px] text-fg3">{{ isMac ? '⌘' : 'Ctrl ' }}K</kbd>
    <div v-if="focused && globalSearch.trim().length >= 2" class="absolute top-11 right-0 left-0 z-30 overflow-hidden rounded-lg border border-line bg-ink-700 p-1 shadow-2xl">
      <p v-if="!results.length" class="px-3 py-4 text-center text-xs text-fg2">No matches for “{{ globalSearch }}”</p>
      <button v-for="t in results" :key="t.id" class="focus-ring flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left hover:bg-white/[0.06]" @click="pickResult(t.id)">
        <span class="min-w-0"><span class="block truncate text-xs text-fg">{{ t.counterparty }}</span><span class="block truncate font-mono text-[10px] text-fg3">{{ t.external_id }} · {{ t.country }}</span></span>
        <RiskBadge :score="t.risk_score" :show-score="false" />
      </button>
      <button v-if="results.length" class="focus-ring mt-1 w-full rounded-md px-3 py-2 text-left text-[11px] text-hl hover:bg-white/[0.06]" @click="seeAll">See all in Transactions →</button>
    </div>
  </div>
</template>
