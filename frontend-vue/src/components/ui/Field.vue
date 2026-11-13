<script setup lang="ts">
import { useId } from 'vue'
defineProps<{ label: string; hint?: string; error?: string }>()
const id = useId()
</script>

<template>
  <div class="space-y-1.5">
    <label :for="id" class="block text-xs font-medium text-slate-300">{{ label }}</label>
    <slot :id="id" />
    <p v-if="error" class="text-xs text-rose-300" role="alert">{{ error }}</p>
    <p v-else-if="hint" class="text-xs text-slate-500">{{ hint }}</p>
  </div>
</template>
