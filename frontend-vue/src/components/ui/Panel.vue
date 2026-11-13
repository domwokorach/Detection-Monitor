<script setup lang="ts">
import { motion } from 'motion-v'
defineProps<{ title?: string; subtitle?: string; delay?: number; hover?: boolean }>()
</script>

<template>
  <motion.section
    :initial="{ opacity: 0, y: 12 }" :animate="{ opacity: 1, y: 0 }" :transition="{ duration: 0.3, delay: delay ?? 0, ease: 'easeOut' }"
    class="glass flex min-w-0 flex-col rounded-lg p-3.5 transition-[box-shadow,border-color] duration-300"
    :class="hover && 'hover:border-accent/40 hover:shadow-[0_0_24px_-8px_rgb(101_185_238/0.35)]'"
  >
    <header v-if="title || $slots.actions" class="mb-2.5 flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 class="text-[13px] font-semibold text-fg">{{ title }}</h2>
        <p v-if="subtitle" class="mt-0.5 text-[10.5px] text-fg3">{{ subtitle }}</p>
      </div>
      <slot name="actions" />
    </header>
    <slot />
  </motion.section>
</template>
