<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { motion } from 'motion-v'
import { Search, ScrollText, FilterX, ChevronDown } from 'lucide-vue-next'
import { CollapsibleRoot, CollapsibleTrigger, CollapsibleContent } from 'reka-ui'
import { data, refresh, status } from '@/stores/app'
import { dateTime, relative, titleCase } from '@/lib/format'
import { inputCls } from '@/lib/ui'
import Panel from '@/components/ui/Panel.vue'
import Select from '@/components/ui/Select.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import Btn from '@/components/ui/Btn.vue'

const PAGE = 30
const f = reactive({ q: '', actor: 'all', action: 'all', entity: 'all', from: '', to: '' })
const limit = ref(PAGE)
const opts = (values: string[], all: string, fmt = (v: string) => v) => [{ value: 'all', label: all }, ...[...new Set(values)].sort().map(v => ({ value: v, label: fmt(v) }))]
const actors = computed(() => opts(data.audit.map(e => e.actor), 'All actors'))
const actions = computed(() => opts(data.audit.map(e => e.action), 'All event types', titleCase))
const entities = computed(() => opts(data.audit.map(e => e.entity_type), 'All entities', titleCase))

const filtered = computed(() => {
  const q = f.q.trim().toLowerCase()
  const from = f.from ? new Date(f.from + 'T00:00:00').getTime() : -Infinity
  const to = f.to ? new Date(f.to + 'T23:59:59').getTime() : Infinity
  return data.audit.filter(e => {
    const t = +new Date(e.created_at)
    return t >= from && t <= to && (f.actor === 'all' || e.actor === f.actor) && (f.action === 'all' || e.action === f.action)
      && (f.entity === 'all' || e.entity_type === f.entity)
      && (!q || `${e.actor} ${e.action} ${e.entity_type} ${e.entity_id} ${JSON.stringify(e.after ?? {})}`.toLowerCase().includes(q))
  })
})
const active = computed(() => Object.values(f).some(v => v !== '' && v !== 'all'))
watch(f, () => { limit.value = PAGE })
const clear = () => Object.assign(f, { q: '', actor: 'all', action: 'all', entity: 'all', from: '', to: '' })
const loading = computed(() => !status.loaded && !status.error)
const dot = (a: string) => a.includes('RULE') ? 'bg-violet-400' : a.includes('ALERT') ? 'bg-rose-400' : a.includes('LOGIN') ? 'bg-slate-400' : 'bg-cyan-300'
const changes = (e: { before: Record<string, unknown> | null; after: Record<string, unknown> | null }) => {
  const keys = new Set([...Object.keys(e.before ?? {}), ...Object.keys(e.after ?? {})])
  return [...keys].map(k => ({ k, from: e.before?.[k], to: e.after?.[k] })).filter(c => JSON.stringify(c.from) !== JSON.stringify(c.to))
}
const show = (v: unknown) => v === undefined || v === null ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)
</script>

<template>
  <div class="space-y-5">
    <ErrorState v-if="status.error && !status.loaded" :message="status.error" @retry="refresh()" />
    <Panel title="Audit history" :subtitle="`${filtered.length.toLocaleString()} events · tamper-evident hash chain`">
      <template #actions><Btn size="sm" variant="ghost" :disabled="!active" @click="clear"><FilterX :size="14" /> Clear</Btn></template>
      <div class="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div class="relative sm:col-span-2 lg:col-span-3"><Search :size="16" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-500" aria-hidden="true" /><input v-model="f.q" type="search" aria-label="Search audit events" placeholder="Search actor, event, entity ID or content…" :class="[inputCls, 'pl-9']"></div>
        <div class="space-y-1.5 text-xs text-slate-300"><span>Analyst</span><Select v-model="f.actor" :options="actors" label="Filter by actor" /></div>
        <div class="space-y-1.5 text-xs text-slate-300"><span>Event type</span><Select v-model="f.action" :options="actions" label="Filter by event type" /></div>
        <div class="space-y-1.5 text-xs text-slate-300"><span>Entity</span><Select v-model="f.entity" :options="entities" label="Filter by entity" /></div>
        <label class="space-y-1.5 text-xs text-slate-300">From<input v-model="f.from" type="date" :class="inputCls"></label>
        <label class="space-y-1.5 text-xs text-slate-300">To<input v-model="f.to" type="date" :class="inputCls"></label>
      </div>

      <div v-if="loading" class="space-y-3" aria-busy="true"><Skeleton v-for="n in 6" :key="n" class="h-14" /></div>
      <EmptyState v-else-if="!filtered.length" :icon="ScrollText" :title="data.audit.length ? 'No events match these filters' : 'No audit events yet'" :body="data.audit.length ? 'Adjust or clear the filters.' : 'Events appear as analysts and the system act.'" />
      <ol v-else class="relative space-y-1 border-l border-white/10 pl-5">
        <li v-for="(e, i) in filtered.slice(0, limit)" :key="e.seq" class="relative">
          <span class="absolute top-4 -left-[25px] size-2.5 rounded-full ring-4 ring-ink-900" :class="dot(e.action)" aria-hidden="true" />
          <motion.div :initial="{ opacity: 0, x: -8 }" :animate="{ opacity: 1, x: 0 }" :transition="{ duration: 0.2, delay: Math.min(i, 10) * 0.02 }">
            <CollapsibleRoot>
              <CollapsibleTrigger class="focus-ring group flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/5" :disabled="!changes(e).length">
                <span class="min-w-0">
                  <span class="block text-sm font-medium text-white">{{ titleCase(e.action) }} <span class="font-normal text-slate-500">· {{ titleCase(e.entity_type) }}</span></span>
                  <span class="block truncate text-xs text-slate-400">{{ e.actor }} · <span class="font-mono">{{ e.entity_id.slice(0, 8) }}</span></span>
                </span>
                <span class="flex shrink-0 items-center gap-2 text-xs text-slate-500"><time :datetime="e.created_at" :title="dateTime(e.created_at)">{{ relative(e.created_at) }}</time><ChevronDown v-if="changes(e).length" :size="14" class="transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" /></span>
              </CollapsibleTrigger>
              <CollapsibleContent class="overflow-hidden">
                <dl class="mx-3 mb-2 space-y-1 rounded-xl border border-white/8 bg-ink-950/40 p-3 text-xs">
                  <div v-for="c in changes(e)" :key="c.k" class="grid grid-cols-[7rem_1fr] gap-2"><dt class="text-slate-500">{{ titleCase(c.k) }}</dt><dd class="font-mono break-all text-slate-300"><span class="text-rose-300/80 line-through decoration-rose-300/40" v-if="e.before">{{ show(c.from) }}</span><span v-if="e.before"> → </span><span class="text-emerald-300">{{ show(c.to) }}</span></dd></div>
                </dl>
              </CollapsibleContent>
            </CollapsibleRoot>
          </motion.div>
        </li>
      </ol>
      <div v-if="filtered.length > limit" class="mt-4 text-center"><Btn size="sm" @click="limit += PAGE">Show more ({{ filtered.length - limit }} remaining)</Btn></div>
    </Panel>
  </div>
</template>
