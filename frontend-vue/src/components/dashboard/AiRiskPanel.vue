<script setup lang="ts">
import { computed, watch } from 'vue'
import { motion } from 'motion-v'
import { ArrowRight, ShieldCheck } from 'lucide-vue-next'
import { data, openAlert } from '@/stores/app'
import { shortId } from '@/lib/dashboard'
import { money } from '@/lib/format'
import { RISK_META, riskLevel } from '@/lib/risk'
import { detailFor, ensureDetails } from '@/composables/useAlertDetails'
import Skeleton from '@/components/ui/Skeleton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

defineProps<{ loading: boolean }>()
/** Highest-risk alert still needing a decision. */
const top = computed(() => [...data.alerts].filter(a => a.status === 'OPEN' || a.status === 'IN_REVIEW' || a.status === 'ESCALATED').sort((a, b) => b.risk_score - a.risk_score)[0])
watch(top, a => { if (a) ensureDetails([a.id]) }, { immediate: true })
const detail = computed(() => (top.value ? detailFor(top.value.id) : undefined))
const matches = computed(() => [...(detail.value?.matches ?? [])].sort((a, b) => b.score - a.score))
const ruleName = (code: string) => data.rules.find(r => r.code === code)?.name ?? code
const customer = computed(() => data.accounts.find(a => a.id === top.value?.transaction.account_id)?.holder_name)
const level = computed(() => (top.value ? RISK_META[riskLevel(top.value.risk_score)] : null))
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div v-if="loading" class="space-y-2"><Skeleton class="h-24" /><Skeleton class="h-10" /></div>
    <EmptyState v-else-if="!top" :icon="ShieldCheck" title="No open alerts" body="Nothing to explain right now." />
    <template v-else>
      <motion.div :key="top.id" :initial="{ opacity: 0, y: 8 }" :animate="{ opacity: 1, y: 0 }" :transition="{ duration: 0.3 }"
        class="relative flex-1 overflow-hidden rounded-md border border-line bg-gradient-to-br from-ink-700/70 to-ink-900/40 p-3">
        <svg class="ai-hex pointer-events-none absolute top-2 right-2 size-[72px] text-hl" viewBox="0 0 80 80" fill="none" aria-hidden="true">
          <circle cx="40" cy="40" r="37" stroke="currentColor" stroke-opacity=".25" stroke-dasharray="2 4" class="ai-spin" />
          <circle cx="40" cy="40" r="29" stroke="currentColor" stroke-opacity=".15" />
          <path d="M40 18l17 10v20L40 58 23 48V28z" stroke="currentColor" stroke-width="1.2" fill="currentColor" fill-opacity=".08" style="filter:drop-shadow(0 0 6px #65B9EE)" />
          <path d="M40 18v20m0 0l17-10M40 38L23 28M40 38v20" stroke="currentColor" stroke-opacity=".6" />
        </svg>
        <p class="text-[11px] font-semibold" :style="{ color: level?.color }">{{ matches[0] ? ruleName(matches[0].rule_code) : 'Suspicious activity detected' }}</p>
        <p class="mt-1 max-w-[78%] text-[10.5px] leading-snug text-fg2">
          {{ matches[0]?.reason ?? `Alert ${shortId(top.id)} scored ${top.risk_score}/100.` }}
        </p>
        <p class="mt-2.5 text-[10px] text-fg3" title="Derived from the alert's rule-engine score; not a statistical model confidence.">Confidence score</p>
        <div class="mt-1 flex items-center gap-2">
          <div class="h-1 flex-1 overflow-hidden rounded-full bg-ink-600" role="progressbar" :aria-valuenow="top.risk_score" aria-valuemin="0" aria-valuemax="100" aria-label="Confidence score">
            <motion.div :initial="{ width: 0 }" :animate="{ width: `${top.risk_score}%` }" :transition="{ duration: 0.8, ease: 'easeOut' }" class="h-full rounded-full bg-gradient-to-r from-accent to-ice" />
          </div>
          <span class="text-[10.5px] text-fg tnum">{{ top.risk_score }}%</span>
        </div>
      </motion.div>
      <ul class="mt-2.5 space-y-1.5 text-[10.5px] text-fg2">
        <li class="flex gap-2"><span class="mt-1.5 size-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />{{ money(top.transaction.amount, top.transaction.currency) }} to {{ top.transaction.counterparty }} ({{ top.transaction.country }}){{ customer ? ` from ${customer}` : '' }}</li>
        <li v-for="m in matches.slice(1, 3)" :key="m.id" class="flex gap-2"><span class="mt-1.5 size-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />{{ m.reason }}</li>
        <li v-if="!detail" class="text-fg3">Loading supporting evidence…</li>
      </ul>
      <button class="focus-ring group mt-3 flex w-full items-center justify-between rounded-md border border-line bg-ink-800 px-3 py-2 text-[11px] text-fg transition-all duration-200 hover:border-accent/50 hover:shadow-[0_0_16px_-4px_rgb(101_185_238/0.5)]" @click="openAlert(top.id)">
        Open Investigation <ArrowRight :size="13" class="transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
      </button>
    </template>
  </div>
</template>

<style scoped>
.ai-spin { transform-origin: 40px 40px; animation: spin 40s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .ai-spin { animation: none; } }
</style>
