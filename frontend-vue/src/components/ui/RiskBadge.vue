<script setup lang="ts">
import { computed } from 'vue'
import { motion } from 'motion-v'
import { RISK_META, riskLevel } from '@/lib/risk'

const props = defineProps<{ score: number; showScore?: boolean }>()
const level = computed(() => riskLevel(props.score))
const meta = computed(() => RISK_META[level.value])
</script>

<template>
  <motion.span
    :initial="{ opacity: 0, scale: 0.85 }" :animate="{ opacity: 1, scale: 1 }" :transition="{ duration: 0.2 }"
    class="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap"
    :style="{ color: meta.color, borderColor: meta.color + '55', background: meta.color + '1a' }"
  >
    <span aria-hidden="true" class="text-[9px] leading-none">{{ meta.glyph }}</span>
    {{ meta.label }}<span v-if="showScore !== false" class="font-mono opacity-80">· {{ score }}</span>
  </motion.span>
</template>
