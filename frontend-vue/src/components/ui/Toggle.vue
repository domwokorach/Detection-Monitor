<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'
defineProps<{ label: string; disabled?: boolean }>()
const model = defineModel<boolean>({ required: true })
</script>

<template>
  <SwitchRoot v-model="model" :aria-label="label" :disabled="disabled"
    class="focus-ring relative h-6 w-11 shrink-0 rounded-full border border-white/10 bg-white/10 transition-colors data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-violet-500 data-[state=checked]:to-cyan-500 disabled:opacity-50">
    <SwitchThumb class="block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform duration-150 data-[state=checked]:translate-x-[22px]" />
  </SwitchRoot>
</template>
