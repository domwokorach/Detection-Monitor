<script setup lang="ts">
import { computed, ref } from 'vue'
import { motion } from 'motion-v'
import { ArrowLeftRight } from 'lucide-vue-next'
import { data, navigate } from '@/stores/app'
import { ago, shortId } from '@/lib/dashboard'
import { money } from '@/lib/format'
import { RISK_META, riskLevel } from '@/lib/risk'
import Skeleton from '@/components/ui/Skeleton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import TransactionDrawer from '@/components/TransactionDrawer.vue'
import type { Transaction } from '@/types'

defineProps<{ loading: boolean }>()
const rows = computed(() => [...data.transactions].sort((a, b) => +new Date(b.occurred_at) - +new Date(a.occurred_at)).slice(0, 6))
const alertTx = computed(() => new Set(data.alerts.map(a => a.transaction_id)))
const customer = (id: string) => data.accounts.find(a => a.id === id)?.holder_name ?? '—'
/** Monitoring status derives from real screening state: Pending → Screened → Flagged (an alert exists). */
const status = (t: Transaction) => t.screening_status !== 'SCREENED' ? { label: 'Pending', cls: 'text-fg3' } : alertTx.value.has(t.id) ? { label: 'Flagged', cls: 'text-sev-high' } : { label: 'Cleared', cls: 'text-ok' }
const open = ref(false)
const sel = ref<Transaction | null>(null)
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div v-if="loading" class="space-y-1.5"><Skeleton v-for="n in 5" :key="n" class="h-8" /></div>
    <EmptyState v-else-if="!rows.length" :icon="ArrowLeftRight" title="No transactions yet" body="Transactions appear here as they are ingested." />
    <div v-else class="-mx-1 overflow-x-auto px-1">
      <table class="w-full min-w-[500px] text-left text-[11px]">
        <caption class="sr-only">Latest monitored transactions</caption>
        <thead><tr class="text-[10px] text-fg3">
          <th scope="col" class="pb-1.5 font-medium">Transaction</th><th scope="col" class="pb-1.5 font-medium">Customer</th><th scope="col" class="pb-1.5 text-right font-medium">Amount</th>
          <th scope="col" class="pb-1.5 pl-3 font-medium">Risk</th><th scope="col" class="pb-1.5 font-medium">Status</th><th scope="col" class="pb-1.5 text-right font-medium">Time</th>
        </tr></thead>
        <tbody>
          <motion.tr v-for="(t, i) in rows" :key="t.id" :initial="{ opacity: 0, x: -8 }" :animate="{ opacity: 1, x: 0 }" :transition="{ duration: 0.22, delay: 0.45 + i * 0.04 }"
            class="cursor-pointer border-t border-line/70 transition-colors duration-200 hover:bg-accent/[0.06] focus-within:bg-accent/[0.06]" @click="sel = t; open = true">
            <td class="py-2 pr-2 whitespace-nowrap"><button class="focus-ring rounded text-fg tnum" :aria-label="`Inspect transaction ${t.external_id}`" @click.stop="sel = t; open = true">{{ shortId(t.id, 'TRX') }}</button></td>
            <td class="max-w-[100px] truncate py-2 pr-2 text-fg">{{ customer(t.account_id) }}</td>
            <td class="py-2 text-right whitespace-nowrap text-fg tnum">{{ money(t.amount, t.currency) }}</td>
            <td class="py-2 pl-3 pr-2 whitespace-nowrap" :style="{ color: RISK_META[riskLevel(t.risk_score)].color }"><span aria-hidden="true" class="mr-1 text-[8px]">{{ RISK_META[riskLevel(t.risk_score)].glyph }}</span>{{ t.screening_status === 'SCREENED' ? RISK_META[riskLevel(t.risk_score)].label : '—' }}</td>
            <td class="py-2 pr-2 whitespace-nowrap" :class="status(t).cls">{{ status(t).label }}</td>
            <td class="py-2 text-right whitespace-nowrap text-fg3 tnum">{{ ago(t.occurred_at) }}</td>
          </motion.tr>
        </tbody>
      </table>
    </div>
    <button class="focus-ring mt-auto w-full rounded-md border border-line py-1.5 text-center text-[10.5px] text-fg2 transition-colors duration-200 hover:border-accent/40 hover:text-hl" @click="navigate('transactions')">View all transactions</button>
    <TransactionDrawer v-model:open="open" :tx="sel" />
  </div>
</template>
