<script setup lang="ts">
import { SelectRoot, SelectTrigger, SelectValue, SelectPortal, SelectContent, SelectViewport, SelectItem, SelectItemIndicator, SelectItemText, SelectIcon } from 'reka-ui'
import { Check, ChevronDown } from 'lucide-vue-next'

defineProps<{ options: { value: string; label: string }[]; label: string; id?: string }>()
const model = defineModel<string>({ required: true })
</script>

<template>
  <SelectRoot v-model="model">
    <SelectTrigger :id="id" :aria-label="label"
      class="focus-ring inline-flex h-9 w-full min-w-[8rem] items-center justify-between gap-2 rounded-md border border-line bg-ink-800 px-3 text-xs text-fg transition-colors duration-200 hover:border-accent/40">
      <SelectValue />
      <SelectIcon><ChevronDown :size="14" class="text-slate-400" aria-hidden="true" /></SelectIcon>
    </SelectTrigger>
    <SelectPortal>
      <SelectContent position="popper" :side-offset="6"
        class="z-[60] min-w-[var(--reka-select-trigger-width)] overflow-hidden rounded-lg border border-line bg-ink-700 p-1 shadow-2xl">
        <SelectViewport>
          <SelectItem v-for="o in options" :key="o.value" :value="o.value"
            class="relative flex cursor-pointer items-center rounded-md py-1.5 pr-3 pl-7 text-xs text-fg outline-none data-[highlighted]:bg-accent/15 data-[highlighted]:text-hl">
            <SelectItemIndicator class="absolute left-2"><Check :size="12" class="text-hl" /></SelectItemIndicator>
            <SelectItemText>{{ o.label }}</SelectItemText>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
