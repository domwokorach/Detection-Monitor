<script setup lang="ts">
import { SliderRoot, SliderTrack, SliderRange, SliderThumb } from 'reka-ui'
import { inputCls } from '@/lib/ui'
import { computed } from 'vue'

const props = defineProps<{ label: string; min: number; max: number; step?: number; unit?: string }>()
const model = defineModel<number>({ required: true })
const arr = computed({ get: () => [model.value], set: v => { if (v?.length) model.value = v[0] } })
function onInput(e: Event) {
  const n = Number((e.target as HTMLInputElement).value)
  if (Number.isFinite(n)) model.value = Math.min(props.max, Math.max(props.min, n))
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between gap-3">
      <span class="text-xs font-medium text-slate-300">{{ label }}</span>
      <div class="flex items-center gap-1.5">
        <input :value="model" type="number" :min="min" :max="max" :step="step ?? 1" :aria-label="`${label} value`" :class="[inputCls, '!w-24 !py-1 text-right font-mono']" @change="onInput">
        <span v-if="unit" class="text-xs text-slate-500">{{ unit }}</span>
      </div>
    </div>
    <SliderRoot v-model="arr" :min="min" :max="max" :step="step ?? 1" class="relative flex h-5 w-full touch-none items-center select-none" :aria-label="label">
      <SliderTrack class="relative h-1.5 grow rounded-full bg-white/10"><SliderRange class="absolute h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" /></SliderTrack>
      <SliderThumb class="focus-ring block size-4 rounded-full border-2 border-white bg-ink-900 shadow-lg shadow-violet-500/40 transition-transform hover:scale-125" :aria-label="label" />
    </SliderRoot>
  </div>
</template>
