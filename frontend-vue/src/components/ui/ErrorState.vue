<script setup lang="ts">
import { TriangleAlert, RotateCw } from 'lucide-vue-next'
defineProps<{ message: string }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <div role="alert" class="glass flex items-center gap-3 rounded-2xl border-rose-500/30 p-4 text-sm">
    <TriangleAlert class="shrink-0 text-rose-400" :size="18" aria-hidden="true" />
    <span class="flex-1 text-slate-200">{{ message }}</span>
    <button class="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs hover:bg-white/10" @click="$emit('retry')">
      <RotateCw :size="13" aria-hidden="true" /> Retry
    </button>
  </div>
</template>
