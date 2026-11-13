<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { motion } from 'motion-v'
import { TabsRoot, TabsList, TabsTrigger, TabsContent } from 'reka-ui'
import { UserCheck, Play, Siren, CheckCheck, FileSearch, Clock3 } from 'lucide-vue-next'
import { backend, data, guarded, user } from '@/stores/app'
import type { AlertDetail, AlertReview } from '@/types'
import { dateTime, money, relative, titleCase } from '@/lib/format'
import { inputCls } from '@/lib/ui'
import RiskBadge from '@/components/ui/RiskBadge.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import Btn from '@/components/ui/Btn.vue'
import Field from '@/components/ui/Field.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Select from '@/components/ui/Select.vue'

const props = defineProps<{ alertId: string }>()

const detail = ref<AlertDetail | null>(null)
const loading = ref(true)
const error = ref('')
const note = ref('')
const disposition = ref('')
const closing = ref(false)
const busy = ref(false)
const tab = ref('evidence')

async function load(silent = false) {
  if (!silent) loading.value = true
  try { detail.value = await backend().alert(props.alertId); error.value = '' }
  catch (e) { error.value = e instanceof Error ? e.message : 'Could not load alert' }
  finally { loading.value = false }
}
watch(() => props.alertId, () => { note.value = ''; disposition.value = ''; closing.value = false; tab.value = 'evidence'; void load() }, { immediate: true })
// Shared polling refreshes data.alerts; re-pull this case when its row changes.
watch(() => data.alerts.find(a => a.id === props.alertId)?.updated_at, () => void load(true))

const locked = computed(() => !!detail.value && (detail.value.status === 'CLOSED'
  || (!!detail.value.assigned_to && detail.value.assigned_to !== user.value?.id && user.value?.role !== 'admin')))
const lockReason = computed(() => detail.value?.status === 'CLOSED' ? 'This case is closed and immutable.' : 'Assigned to another analyst.')
const timeline = computed(() => {
  if (!detail.value) return []
  const ids = new Set([detail.value.id, detail.value.transaction_id])
  return data.audit.filter(e => ids.has(e.entity_id)).sort((a, b) => b.seq - a.seq)
})
const account = computed(() => data.accounts.find(a => a.id === detail.value?.transaction.account_id))
const noteTooShort = computed(() => closing.value && note.value.trim().length < 10)

async function submit(body: AlertReview, success: string) {
  busy.value = true
  const result = await guarded(() => backend().reviewAlert(props.alertId, body), success)
  busy.value = false
  if (result) { note.value = ''; disposition.value = ''; closing.value = false; await load(true) }
}
const act = (status: AlertReview['status'], success: string) => submit({ status, note: note.value || null, assign_to_me: true }, success)
function resolve() {
  if (!closing.value) { closing.value = true; return }
  if (!disposition.value || noteTooShort.value) return
  void submit({ status: 'CLOSED', disposition: disposition.value as 'SUSPICIOUS' | 'FALSE_POSITIVE', note: note.value, assign_to_me: true }, 'Case resolved')
}
const dispositions = [{ value: '', label: 'Select disposition…' }, { value: 'SUSPICIOUS', label: 'Confirmed suspicious' }, { value: 'FALSE_POSITIVE', label: 'False positive' }]
</script>

<template>
  <div v-if="loading" class="space-y-4" aria-busy="true" aria-label="Loading case">
    <Skeleton class="h-24" /><Skeleton class="h-40" /><Skeleton class="h-32" />
  </div>
  <ErrorState v-else-if="error" :message="error" @retry="load()" />
  <div v-else-if="detail" class="space-y-5">
    <motion.div :initial="{ opacity: 0, y: 8 }" :animate="{ opacity: 1, y: 0 }" :transition="{ duration: 0.22 }" class="glass rounded-2xl p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-xs text-slate-400">{{ account?.holder_name ?? 'Account' }} · {{ account?.account_number_masked }}</p>
          <p class="mt-1 text-2xl font-semibold tracking-tight text-white tabular-nums">{{ money(detail.transaction.amount, detail.transaction.currency) }}</p>
          <p class="mt-0.5 text-sm text-slate-300">{{ detail.transaction.direction === 'DEBIT' ? 'to' : 'from' }} {{ detail.transaction.counterparty }} · {{ detail.transaction.country }}</p>
        </div>
        <div class="flex flex-col items-end gap-2"><RiskBadge :score="detail.risk_score" /><StatusBadge :status="detail.status" /></div>
      </div>
      <dl class="mt-4 grid grid-cols-2 gap-3 border-t border-white/8 pt-3 text-xs">
        <div><dt class="text-slate-500">Occurred</dt><dd class="mt-0.5 text-slate-200">{{ dateTime(detail.transaction.occurred_at) }}</dd></div>
        <div><dt class="text-slate-500">Reference</dt><dd class="mt-0.5 truncate font-mono text-slate-200">{{ detail.transaction.external_id }}</dd></div>
        <div><dt class="text-slate-500">Assignee</dt><dd class="mt-0.5 text-slate-200">{{ detail.assigned_to ? (detail.assigned_to === user?.id ? 'You' : 'Another analyst') : 'Unassigned' }}</dd></div>
        <div><dt class="text-slate-500">Disposition</dt><dd class="mt-0.5 text-slate-200">{{ detail.disposition ? titleCase(detail.disposition) : '—' }}</dd></div>
      </dl>
    </motion.div>

    <TabsRoot v-model="tab">
      <TabsList class="flex gap-1 rounded-xl border border-white/8 bg-white/5 p-1" aria-label="Case sections">
        <TabsTrigger v-for="t in [{ v: 'evidence', l: 'Evidence', i: FileSearch }, { v: 'timeline', l: `Timeline (${timeline.length})`, i: Clock3 }]" :key="t.v" :value="t.v"
          class="focus-ring relative flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm text-slate-400 data-[state=active]:text-white">
          <motion.span v-if="tab === t.v" layout-id="case-tab" class="absolute inset-0 rounded-lg bg-white/10" :transition="{ type: 'spring', stiffness: 520, damping: 40 }" />
          <component :is="t.i" :size="14" class="relative" aria-hidden="true" /><span class="relative">{{ t.l }}</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="evidence" class="mt-4 space-y-3 outline-none">
        <EmptyState v-if="!detail.matches.length" :icon="FileSearch" title="No rule evidence recorded" body="This transaction crossed the alert threshold without stored rule matches." />
        <motion.div v-for="(m, i) in detail.matches" :key="m.id" :initial="{ opacity: 0, x: -10 }" :animate="{ opacity: 1, x: 0 }" :transition="{ duration: 0.2, delay: i * 0.05 }" class="glass rounded-xl p-3.5">
          <div class="flex items-center justify-between gap-2">
            <span class="font-mono text-xs text-violet-300">{{ m.rule_code }} <span class="text-slate-500">v{{ m.rule_version }}</span></span>
            <span class="rounded-md bg-rose-500/15 px-2 py-0.5 font-mono text-xs text-rose-200">+{{ m.score }}</span>
          </div>
          <p class="mt-2 text-sm text-slate-200">{{ m.reason }}</p>
          <p class="mt-2 truncate font-mono text-[11px] text-slate-500">config: {{ JSON.stringify(m.rule_config_snapshot) }}</p>
        </motion.div>
      </TabsContent>

      <TabsContent value="timeline" class="mt-4 outline-none">
        <EmptyState v-if="!timeline.length" :icon="Clock3" title="No history yet" />
        <ol v-else class="relative space-y-4 border-l border-white/10 pl-5">
          <li v-for="(e, i) in timeline" :key="e.seq" class="relative">
            <motion.span :initial="{ scale: 0 }" :animate="{ scale: 1 }" :transition="{ delay: i * 0.04, type: 'spring', stiffness: 500, damping: 25 }" class="absolute top-1.5 -left-[25px] size-2.5 rounded-full bg-gradient-to-br from-violet-400 to-cyan-300" />
            <p class="text-sm text-white">{{ titleCase(e.action) }}</p>
            <p class="text-xs text-slate-400">{{ e.actor }} · <time :datetime="e.created_at" :title="dateTime(e.created_at)">{{ relative(e.created_at) }}</time></p>
            <p v-if="(e.after as Record<string, unknown> | null)?.review_note" class="mt-1 rounded-lg bg-white/5 p-2 text-xs text-slate-300">“{{ (e.after as Record<string, unknown>).review_note }}”</p>
          </li>
        </ol>
      </TabsContent>
    </TabsRoot>

    <form class="glass space-y-3 rounded-2xl p-4" @submit.prevent="resolve">
      <h3 class="text-sm font-semibold text-white">Review</h3>
      <p v-if="locked" class="rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-200" role="status">{{ lockReason }}</p>
      <template v-else>
        <Field label="Review note" :error="noteTooShort ? 'Closing a case needs a note of at least 10 characters.' : undefined" hint="Visible in the audit history.">
          <template #default="{ id }"><textarea :id="id" v-model="note" rows="3" maxlength="3000" :class="inputCls" placeholder="What did you find?" /></template>
        </Field>
        <Field v-if="closing" label="Disposition">
          <template #default="{ id }"><Select :id="id" v-model="disposition" :options="dispositions" label="Disposition" /></template>
        </Field>
        <div class="flex flex-wrap gap-2">
          <Btn size="sm" :disabled="busy || detail.assigned_to === user?.id" @click="submit({ status: detail.status, assign_to_me: true, note: note || null }, 'Assigned to you')"><UserCheck :size="14" /> Assign to me</Btn>
          <Btn v-if="detail.status === 'OPEN'" size="sm" :disabled="busy" @click="act('IN_REVIEW', 'Review started')"><Play :size="14" /> Start review</Btn>
          <Btn v-if="detail.status !== 'ESCALATED'" size="sm" variant="danger" :disabled="busy" @click="act('ESCALATED', 'Case escalated')"><Siren :size="14" /> Escalate</Btn>
          <Btn size="sm" variant="primary" type="submit" :loading="busy" :disabled="closing && (!disposition || noteTooShort)"><CheckCheck :size="14" /> {{ closing ? 'Confirm resolve' : 'Resolve' }}</Btn>
          <Btn v-if="closing" size="sm" variant="ghost" @click="closing = false">Cancel</Btn>
        </div>
      </template>
    </form>
  </div>
</template>
