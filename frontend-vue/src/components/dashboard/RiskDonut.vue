<script setup lang="ts">
import { computed } from 'vue'
import EChart from '@/components/charts/EChart.vue'
import { tooltip } from '@/lib/chart'
import type { Slice } from '@/lib/dashboard'

const props = defineProps<{ slices: Slice[]; centerLabel: string; label: string; size?: string }>()
const total = computed(() => props.slices.reduce((a, s) => a + s.value, 0))
const option = computed(() => ({
  tooltip: { trigger: 'item', ...tooltip, formatter: '{b}: {c} ({d}%)' },
  series: [{ type: 'pie', radius: ['68%', '88%'], center: ['50%', '50%'], label: { show: false }, avoidLabelOverlap: false, padAngle: 2,
    emphasis: { scaleSize: 4 }, itemStyle: { borderColor: '#0B1E33', borderWidth: 2, borderRadius: 3 },
    data: props.slices.filter(s => s.value > 0).map(s => ({ name: s.label, value: s.value, itemStyle: { color: s.color } })) }],
}))
const pct = (v: number) => (total.value ? ((v / total.value) * 100).toFixed(1) : '0.0')
</script>

<template>
  <div class="flex items-center gap-3">
    <div class="relative shrink-0" :style="{ width: size ?? '118px', height: size ?? '118px' }">
      <EChart :option="option" :height="size ?? '118px'" :label="label" />
      <div class="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div><p class="text-lg leading-none font-semibold text-fg tnum">{{ total.toLocaleString('en-GB') }}</p><p class="mt-1 text-[9.5px] text-fg3">{{ centerLabel }}</p></div>
      </div>
    </div>
    <ul class="min-w-0 flex-1 space-y-1.5 text-[11px]">
      <li v-for="s in slices" :key="s.key" class="flex items-center justify-between gap-2 rounded border border-line/70 bg-ink-900/40 px-2 py-1.5">
        <span class="flex items-center gap-1.5 text-fg2"><span class="size-1.5 rounded-sm" :style="{ background: s.color }" aria-hidden="true" />{{ s.label }}</span>
        <span class="text-fg tnum">{{ s.value.toLocaleString('en-GB') }} <span class="text-fg3">({{ pct(s.value) }}%)</span></span>
      </li>
    </ul>
  </div>
</template>
