<script setup lang="ts">
import type { Component } from 'vue'
import { motion } from 'motion-v'
import { ArrowDownRight, ArrowUpRight } from 'lucide-vue-next'
import CountUp from '@/components/ui/CountUp.vue'
import Sparkline from './Sparkline.vue'

defineProps<{
  label: string; value: number; decimals?: number; suffix?: string; icon: Component; color: string
  change: number | null; spark: number[]; delay: number; compare: string; goodWhenDown?: boolean
}>()
defineEmits<{ open: [] }>()
</script>

<template>
  <motion.button type="button" :initial="{ opacity: 0, y: 14 }" :animate="{ opacity: 1, y: 0 }" :transition="{ duration: 0.3, delay, ease: 'easeOut' }" :while-press="{ scale: 0.99 }"
    class="glass focus-ring group relative overflow-hidden rounded-lg p-3.5 text-left transition-[box-shadow,border-color] duration-300 hover:border-accent/40 hover:shadow-[0_0_24px_-8px_rgb(101_185_238/0.4)]"
    :aria-label="`${label}: ${value}. Open details`" @click="$emit('open')">
    <div class="flex items-center gap-2">
      <span class="grid size-6 place-items-center rounded-md border border-line bg-ink-700" :style="{ color }"><component :is="icon" :size="13" :stroke-width="1.75" aria-hidden="true" /></span>
      <span class="truncate text-[11px] font-medium text-fg2">{{ label }}</span>
    </div>
    <div class="mt-2.5 flex items-end justify-between gap-2">
      <div class="min-w-0">
        <p class="text-[26px] leading-none font-semibold tracking-tight text-fg tnum"><CountUp :value="value" :decimals="decimals" :suffix="suffix" /></p>
        <p class="mt-2 flex items-center gap-1 text-[10px] text-fg3 tnum">
          <template v-if="change !== null">
            <component :is="change >= 0 ? ArrowUpRight : ArrowDownRight" :size="11" :class="(change >= 0) !== !!goodWhenDown ? 'text-ok' : 'text-sev-crit'" aria-hidden="true" />
            <span :class="(change >= 0) !== !!goodWhenDown ? 'text-ok' : 'text-sev-crit'">{{ Math.abs(change).toFixed(1) }}%</span> {{ compare }}
          </template>
          <template v-else>No prior-period baseline</template>
        </p>
      </div>
      <Sparkline :values="spark" :color="color" class="shrink-0 opacity-90 transition-opacity group-hover:opacity-100" />
    </div>
  </motion.button>
</template>
