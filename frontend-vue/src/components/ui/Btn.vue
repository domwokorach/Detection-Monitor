<script setup lang="ts">
import { motion } from 'motion-v'
withDefaults(defineProps<{ variant?: 'primary' | 'ghost' | 'danger' | 'soft'; size?: 'sm' | 'md'; type?: 'button' | 'submit'; disabled?: boolean; loading?: boolean }>(),
  { variant: 'soft', size: 'md', type: 'button' })
</script>

<template>
  <motion.button
    :type="type" :disabled="disabled || loading" :while-hover="disabled ? undefined : { y: -1 }" :while-press="disabled ? undefined : { scale: 0.97 }"
    :transition="{ duration: 0.12 }"
    class="focus-ring inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
    :class="[
      size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
      variant === 'primary' && 'bg-gradient-to-r from-violet-400 to-cyan-300 font-semibold text-ink-900 shadow-lg shadow-violet-400/25 hover:brightness-105',
      variant === 'soft' && 'border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10',
      variant === 'ghost' && 'text-slate-300 hover:bg-white/8 hover:text-white',
      variant === 'danger' && 'border border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20',
    ]"
  >
    <span v-if="loading" class="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
    <slot />
  </motion.button>
</template>
