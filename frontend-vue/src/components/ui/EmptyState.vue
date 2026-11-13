<script setup lang="ts">
import type { Component } from 'vue'
import { motion } from 'motion-v'
defineProps<{ icon: Component; title: string; body?: string }>()
</script>

<template>
  <motion.div :initial="{ opacity: 0, y: 8 }" :animate="{ opacity: 1, y: 0 }" :transition="{ duration: 0.25 }"
    class="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
    <div class="grid size-12 place-items-center rounded-2xl border border-white/10 bg-white/5 text-violet-300">
      <component :is="icon" :size="22" aria-hidden="true" />
    </div>
    <h3 class="text-sm font-semibold text-white">{{ title }}</h3>
    <p v-if="body" class="max-w-sm text-sm text-slate-400">{{ body }}</p>
    <slot />
  </motion.div>
</template>
