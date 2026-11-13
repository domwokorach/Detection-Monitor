<script setup lang="ts">
import { computed, watch } from 'vue'
import { motion } from 'motion-v'
import { ShieldCheck, TriangleAlert } from 'lucide-vue-next'
import { data, navigate, openAlert } from '@/stores/app'
import { ago, shortId } from '@/lib/dashboard'
import { RISK_META, riskLevel } from '@/lib/risk'
import { detailFor, ensureDetails } from '@/composables/useAlertDetails'
import Skeleton from '@/components/ui/Skeleton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

defineProps<{ loading: boolean }>()
const rows = computed(() => [...data.alerts].filter(a => a.status !== 'CLOSED').sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 6))
watch(rows, r => ensureDetails(r.map(a => a.id)), { immediate: true })

const customer = (accountId: string) => data.accounts.find(a => a.id === accountId)?.holder_name ?? '—'
function typeOf(id: string) {
  const top = [...(detailFor(id)?.matches ?? [])].sort((a, b) => b.score - a.score)[0]
  return top ? (data.rules.find(r => r.code === top.rule_code)?.name ?? top.rule_code) : null
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div v-if="loading" class="space-y-1.5"><Skeleton v-for="n in 5" :key="n" class="h-8" /></div>
    <EmptyState v-else-if="!rows.length" :icon="ShieldCheck" title="No open alerts" body="Nothing needs attention right now." />
    <div v-else class="-mx-1 overflow-x-auto px-1">
      <table class="w-full min-w-[430px] text-left text-[11px]">
        <caption class="sr-only">Most recent open alerts</caption>
        <thead><tr class="text-[10px] text-fg3">
          <th scope="col" class="pb-1.5 font-medium">Alert ID</th><th scope="col" class="pb-1.5 font-medium">Type</th><th scope="col" class="pb-1.5 font-medium">Customer</th>
          <th scope="col" class="pb-1.5 font-medium">Risk</th><th scope="col" class="pb-1.5 font-medium">Severity</th><th scope="col" class="pb-1.5 text-right font-medium">Time</th>
        </tr></thead>
        <tbody>
          <motion.tr v-for="(a, i) in rows" :key="a.id" :initial="{ opacity: 0, x: -8 }" :animate="{ opacity: 1, x: 0 }" :transition="{ duration: 0.22, delay: 0.4 + i * 0.04 }"
            class="group cursor-pointer border-t border-line/70 transition-colors duration-200 hover:bg-accent/[0.06] focus-within:bg-accent/[0.06]" @click="openAlert(a.id)">
            <td class="py-2 pr-2 whitespace-nowrap">
              <button class="focus-ring flex items-center gap-1.5 rounded text-fg tnum" :aria-label="`Open alert ${shortId(a.id)}`" @click.stop="openAlert(a.id)">
                <TriangleAlert :size="12" :style="{ color: RISK_META[riskLevel(a.risk_score)].color }" aria-hidden="true" />{{ shortId(a.id) }}
              </button>
            </td>
            <td class="max-w-[92px] truncate py-2 pr-2 text-fg2" :title="typeOf(a.id) ?? ''">{{ typeOf(a.id) ?? '…' }}</td>
            <td class="max-w-[96px] truncate py-2 pr-2 text-fg">{{ customer(a.transaction.account_id) }}</td>
            <td class="py-2 pr-2"><span class="inline-flex min-w-7 justify-center rounded px-1.5 py-px font-medium tnum" :style="{ color: RISK_META[riskLevel(a.risk_score)].color, background: RISK_META[riskLevel(a.risk_score)].color + '1f' }">{{ a.risk_score }}</span></td>
            <td class="py-2 pr-2 whitespace-nowrap" :style="{ color: RISK_META[riskLevel(a.risk_score)].color }"><span aria-hidden="true" class="mr-1 text-[8px]">{{ RISK_META[riskLevel(a.risk_score)].glyph }}</span>{{ RISK_META[riskLevel(a.risk_score)].label }}</td>
            <td class="py-2 text-right whitespace-nowrap text-fg3 tnum">{{ ago(a.created_at) }}</td>
          </motion.tr>
        </tbody>
      </table>
    </div>
    <button class="focus-ring mt-auto self-end rounded px-1 pt-2 text-[10.5px] text-hl hover:underline" @click="navigate('alerts')">View all</button>
  </div>
</template>
