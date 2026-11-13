<script setup lang="ts">
import { computed, useId } from 'vue'
const props = defineProps<{ values: number[]; color: string; width?: number; height?: number }>()
const w = computed(() => props.width ?? 96), h = computed(() => props.height ?? 36)
const id = useId()
const pts = computed(() => {
  const v = props.values
  if (v.length < 2) return []
  const min = Math.min(...v), max = Math.max(...v), span = max - min || 1
  return v.map((y, i) => [(i / (v.length - 1)) * w.value, h.value - 3 - ((y - min) / span) * (h.value - 8)] as const)
})
/** Smooth monotone-ish curve through the points (Catmull-Rom → cubic Bézier). */
const line = computed(() => {
  const p = pts.value
  if (!p.length) return ''
  let d = `M${p[0][0]},${p[0][1]}`
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] ?? p2
    d += `C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`
  }
  return d
})
const area = computed(() => (line.value ? `${line.value}L${w.value},${h.value}L0,${h.value}Z` : ''))
</script>

<template>
  <svg :viewBox="`0 0 ${w} ${h}`" :width="w" :height="h" class="overflow-visible" aria-hidden="true">
    <defs><linearGradient :id="`sg${id}`" x1="0" y1="0" x2="0" y2="1"><stop offset="0" :stop-color="color" stop-opacity=".28" /><stop offset="1" :stop-color="color" stop-opacity="0" /></linearGradient></defs>
    <template v-if="pts.length">
      <path :d="area" :fill="`url(#sg${id})`" class="spark-fade" />
      <path :d="line" fill="none" :stroke="color" stroke-width="1.5" stroke-linecap="round" pathLength="1" class="spark-draw" :style="{ filter: `drop-shadow(0 0 3px ${color}88)` }" />
    </template>
    <line v-else x1="0" :x2="w" :y1="h - 4" :y2="h - 4" :stroke="color" stroke-opacity=".3" stroke-dasharray="2 3" />
  </svg>
</template>

<style scoped>
.spark-draw { stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw 1s .15s ease-out forwards; }
.spark-fade { opacity: 0; animation: fade .6s .6s ease-out forwards; }
@keyframes draw { to { stroke-dashoffset: 0; } }
@keyframes fade { to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .spark-draw { animation: none; stroke-dashoffset: 0; } .spark-fade { animation: none; opacity: 1; } }
</style>
