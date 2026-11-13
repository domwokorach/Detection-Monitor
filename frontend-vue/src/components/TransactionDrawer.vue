<script setup lang="ts">
import { computed } from 'vue'
import { ArrowRight } from 'lucide-vue-next'
import Drawer from '@/components/ui/Drawer.vue'
import RiskBadge from '@/components/ui/RiskBadge.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import Btn from '@/components/ui/Btn.vue'
import { data, openAlert } from '@/stores/app'
import { dateTime, money } from '@/lib/format'
import type { Transaction } from '@/types'

const props = defineProps<{ tx: Transaction | null }>()
const open = defineModel<boolean>('open', { required: true })
const account = computed(() => data.accounts.find(a => a.id === props.tx?.account_id))
const alert = computed(() => data.alerts.find(a => a.transaction_id === props.tx?.id))
</script>

<template>
  <Drawer v-model:open="open" title="Transaction details" :description="tx?.external_id">
    <div v-if="tx" class="space-y-5">
      <div class="glass rounded-2xl p-5 text-center">
        <p class="text-3xl font-semibold tracking-tight text-white tabular-nums">{{ money(tx.amount, tx.currency) }}</p>
        <p class="mt-1 text-sm text-slate-400">{{ tx.direction === 'DEBIT' ? 'Outgoing to' : 'Incoming from' }} {{ tx.counterparty }}</p>
        <div class="mt-3 flex justify-center gap-2"><RiskBadge :score="tx.risk_score" /><StatusBadge :status="tx.screening_status" /></div>
      </div>
      <dl class="grid grid-cols-2 gap-4 text-sm">
        <div><dt class="text-xs text-slate-500">Account</dt><dd class="mt-0.5 text-slate-200">{{ account?.holder_name ?? tx.account_id }}</dd></div>
        <div><dt class="text-xs text-slate-500">Account number</dt><dd class="mt-0.5 font-mono text-slate-200">{{ account?.account_number_masked ?? '—' }}</dd></div>
        <div><dt class="text-xs text-slate-500">Destination country</dt><dd class="mt-0.5 text-slate-200">{{ tx.country }} <span v-if="account && account.home_country !== tx.country" class="text-amber-300">(≠ home {{ account.home_country }})</span></dd></div>
        <div><dt class="text-xs text-slate-500">Occurred</dt><dd class="mt-0.5 text-slate-200">{{ dateTime(tx.occurred_at) }}</dd></div>
        <div><dt class="text-xs text-slate-500">Direction</dt><dd class="mt-0.5 text-slate-200">{{ tx.direction }}</dd></div>
        <div><dt class="text-xs text-slate-500">Risk score</dt><dd class="mt-0.5 font-mono text-slate-200">{{ tx.risk_score }} / 100</dd></div>
      </dl>
      <Btn v-if="alert" variant="primary" class="w-full" @click="open = false; openAlert(alert.id)">Investigate alert <ArrowRight :size="15" /></Btn>
      <p v-else class="rounded-xl border border-white/8 bg-white/5 p-3 text-center text-sm text-slate-400">No alert was raised for this transaction.</p>
    </div>
  </Drawer>
</template>
