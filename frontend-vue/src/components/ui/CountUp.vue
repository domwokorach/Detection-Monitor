<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { animate } from 'motion-v'

const props = defineProps<{ value: number; decimals?: number; suffix?: string }>()
const shown = ref(0)
let first = true

function run(to: number) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) { shown.value = to; return }
  animate(shown.value, to, { duration: first ? 1.1 : 0.5, ease: 'easeOut', onUpdate: v => { shown.value = v } })
  first = false
}
onMounted(() => run(props.value))
watch(() => props.value, run)
</script>

<template>
  <span class="tabular-nums">{{ shown.toLocaleString('en-GB', { minimumFractionDigits: decimals ?? 0, maximumFractionDigits: decimals ?? 0 }) }}{{ suffix }}</span>
</template>
