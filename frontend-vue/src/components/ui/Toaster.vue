<script setup lang="ts">
import { AnimatePresence, motion } from 'motion-v'
import { CheckCircle2, CircleAlert, Info, TriangleAlert, X } from 'lucide-vue-next'
import { toasts, dismissToast } from '@/stores/toast'

const icons = { success: CheckCircle2, error: CircleAlert, info: Info, warning: TriangleAlert }
const tones = { success: 'text-emerald-300', error: 'text-rose-300', info: 'text-cyan-300', warning: 'text-amber-300' }
</script>

<template>
  <div class="pointer-events-none fixed right-4 bottom-4 z-[70] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2" role="region" aria-label="Notifications" aria-live="polite">
    <AnimatePresence>
      <motion.div v-for="t in toasts" :key="t.id" layout
        :initial="{ opacity: 0, x: 40, scale: 0.96 }" :animate="{ opacity: 1, x: 0, scale: 1 }" :exit="{ opacity: 0, x: 40, scale: 0.96 }"
        :transition="{ type: 'spring', stiffness: 460, damping: 34 }"
        class="glass pointer-events-auto flex items-start gap-3 rounded-2xl bg-ink-800/95 p-3.5" role="status">
        <component :is="icons[t.tone]" :size="18" class="mt-0.5 shrink-0" :class="tones[t.tone]" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-white">{{ t.title }}</p>
          <p v-if="t.body" class="mt-0.5 text-xs break-words text-slate-400">{{ t.body }}</p>
        </div>
        <button class="focus-ring rounded-md p-1 text-slate-500 hover:text-white" aria-label="Dismiss notification" @click="dismissToast(t.id)"><X :size="14" /></button>
      </motion.div>
    </AnimatePresence>
  </div>
</template>
