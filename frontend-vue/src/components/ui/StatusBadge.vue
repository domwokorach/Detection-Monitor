<script setup lang="ts">
import { computed } from 'vue'
import { titleCase } from '@/lib/format'

const props = defineProps<{ status: string }>()
const tone = computed(() => ({
  OPEN: 'text-cyan-300 border-cyan-400/30 bg-cyan-400/10',
  IN_REVIEW: 'text-violet-300 border-violet-400/30 bg-violet-400/10',
  ESCALATED: 'text-rose-300 border-rose-400/30 bg-rose-400/10',
  CLOSED: 'text-slate-300 border-white/15 bg-white/5',
  SCREENED: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10',
  PENDING: 'text-amber-300 border-amber-400/30 bg-amber-400/10',
  FAILED: 'text-rose-300 border-rose-400/30 bg-rose-400/10',
}[props.status] ?? 'text-slate-300 border-white/15 bg-white/5'))
</script>

<template>
  <span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap" :class="tone">
    {{ titleCase(status) }}
  </span>
</template>
