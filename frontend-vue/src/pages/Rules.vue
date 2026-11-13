<script setup lang="ts">
import { computed, ref } from 'vue'
import { motion } from 'motion-v'
import { CollapsibleRoot, CollapsibleTrigger, CollapsibleContent } from 'reka-ui'
import { ChevronDown, Plus, Pencil, SlidersHorizontal, Lock } from 'lucide-vue-next'
import { backend, data, guarded, isAdmin, refresh, status } from '@/stores/app'
import { relative, titleCase } from '@/lib/format'
import Toggle from '@/components/ui/Toggle.vue'
import Btn from '@/components/ui/Btn.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import CountUp from '@/components/ui/CountUp.vue'
import RuleDialog from '@/components/RuleDialog.vue'
import type { Rule } from '@/types'

const dialog = ref(false)
const editing = ref<Rule | null>(null)
const expanded = ref<Record<string, boolean>>({})
const stat = (code: string) => data.ruleStats.find(s => s.rule_code === code)
const maxMatches = computed(() => Math.max(1, ...data.ruleStats.map(s => s.matches)))
const loading = computed(() => !status.loaded && !status.error)

function openDialog(rule: Rule | null) { editing.value = rule; dialog.value = true }
const toggle = (r: Rule, enabled: boolean) => guarded(() => backend().updateRule(r.id, { expected_version: r.version, enabled }), `${r.name} ${enabled ? 'enabled' : 'disabled'}`)
const describe = (r: Rule) => Object.entries(r.config).map(([k, v]) => [titleCase(k), Array.isArray(v) ? v.join(', ') : String(v)] as const)
</script>

<template>
  <div class="space-y-5">
    <ErrorState v-if="status.error && !status.loaded" :message="status.error" @retry="refresh()" />
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm text-slate-400">{{ data.rules.filter(r => r.enabled).length }} of {{ data.rules.length }} rules active. Scores add up across matching rules.</p>
      <Btn v-if="isAdmin" variant="primary" @click="openDialog(null)"><Plus :size="16" /> New rule</Btn>
      <span v-else class="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-400"><Lock :size="12" aria-hidden="true" /> Read-only · admin access required to edit</span>
    </div>

    <div v-if="loading" class="grid gap-4 lg:grid-cols-2"><Skeleton v-for="n in 4" :key="n" class="h-40 !rounded-2xl" /></div>
    <EmptyState v-else-if="!data.rules.length" :icon="SlidersHorizontal" title="No rules configured" body="Create a rule to start flagging suspicious transactions." />
    <div v-else class="grid items-start gap-4 lg:grid-cols-2">
      <motion.div v-for="(r, i) in data.rules" :key="r.id" :initial="{ opacity: 0, y: 16 }" :animate="{ opacity: 1, y: 0 }" :transition="{ duration: 0.28, delay: i * 0.06 }" :while-hover="{ y: -2 }"
        class="glass rounded-2xl p-5 transition-shadow hover:shadow-[0_0_0_1px_rgb(105_184_240/0.35),0_20px_50px_-22px_rgb(105_184_240/0.4)]" :class="!r.enabled && 'opacity-70'">
        <CollapsibleRoot v-model:open="expanded[r.id]">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="font-mono text-[11px] text-violet-300">{{ r.code }} · v{{ r.version }}</p>
              <h3 class="mt-1 text-base font-semibold text-white">{{ r.name }}</h3>
              <p class="mt-1 text-sm text-slate-400">{{ r.description || titleCase(r.kind) }}</p>
            </div>
            <Toggle :model-value="r.enabled" :label="`${r.name} enabled`" :disabled="!isAdmin" @update:model-value="toggle(r, $event)" />
          </div>

          <div class="mt-4 grid grid-cols-3 gap-3 text-xs">
            <div><p class="text-slate-500">Weight</p><p class="mt-0.5 text-lg font-semibold text-white tabular-nums">+{{ r.weight }}</p></div>
            <div><p class="text-slate-500">Matches</p><p class="mt-0.5 text-lg font-semibold text-white"><CountUp :value="stat(r.code)?.matches ?? 0" /></p></div>
            <div><p class="text-slate-500">Last matched</p><p class="mt-1 text-sm text-slate-200">{{ stat(r.code)?.last_matched_at ? relative(stat(r.code)!.last_matched_at!) : 'Never' }}</p></div>
          </div>
          <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8" role="presentation">
            <motion.div :initial="{ width: 0 }" :animate="{ width: `${((stat(r.code)?.matches ?? 0) / maxMatches) * 100}%` }" :transition="{ duration: 0.6, ease: 'easeOut' }" class="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" />
          </div>

          <div class="mt-4 flex items-center justify-between">
            <CollapsibleTrigger class="focus-ring flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-slate-300 hover:bg-white/8">
              Configuration <ChevronDown :size="14" class="transition-transform" :class="expanded[r.id] && 'rotate-180'" aria-hidden="true" />
            </CollapsibleTrigger>
            <Btn v-if="isAdmin" size="sm" @click="openDialog(r)"><Pencil :size="13" /> Edit</Btn>
          </div>
          <CollapsibleContent class="overflow-hidden data-[state=closed]:animate-[collapse_0.2s_ease-out] data-[state=open]:animate-[expand_0.22s_ease-out]">
            <dl class="mt-3 space-y-1.5 rounded-xl border border-white/8 bg-ink-950/40 p-3 text-xs">
              <div v-for="[k, v] in describe(r)" :key="k" class="flex justify-between gap-4"><dt class="text-slate-500">{{ k }}</dt><dd class="font-mono text-slate-200">{{ v }}</dd></div>
              <div class="flex justify-between gap-4"><dt class="text-slate-500">Updated</dt><dd class="text-slate-200">{{ relative(r.updated_at) }}</dd></div>
            </dl>
          </CollapsibleContent>
        </CollapsibleRoot>
      </motion.div>
    </div>
    <RuleDialog v-model:open="dialog" :rule="editing" />
  </div>
</template>

<style>
@keyframes expand { from { height: 0; opacity: 0 } to { height: var(--reka-collapsible-content-height); opacity: 1 } }
@keyframes collapse { from { height: var(--reka-collapsible-content-height); opacity: 1 } to { height: 0; opacity: 0 } }
@media (prefers-reduced-motion: reduce) { [data-state] { animation-duration: 0.01ms !important } }
</style>
