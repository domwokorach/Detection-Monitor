<script setup lang="ts">
import { computed } from 'vue'
import { DropdownMenuRoot, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuItemIndicator } from 'reka-ui'
import { Moon, Sun, Monitor, Check } from 'lucide-vue-next'
import { setThemeMode, themeMode, type ThemeMode } from '@/stores/theme'

const options: { id: ThemeMode; label: string; icon: typeof Moon }[] = [
  { id: 'dark', label: 'Dark', icon: Moon }, { id: 'light', label: 'Light', icon: Sun }, { id: 'system', label: 'System', icon: Monitor },
]
const current = computed(() => options.find(o => o.id === themeMode.value)!)
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger class="focus-ring grid size-8 place-items-center rounded-md border border-line bg-ink-800 text-fg2 transition-colors duration-200 hover:text-fg" :aria-label="`Theme: ${current.label}`">
      <component :is="current.icon" :size="15" aria-hidden="true" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent align="end" :side-offset="8" class="z-50 min-w-36 rounded-lg border border-line bg-ink-700 p-1 shadow-2xl">
        <DropdownMenuRadioGroup :model-value="themeMode" @update:model-value="setThemeMode($event as ThemeMode)">
          <DropdownMenuRadioItem v-for="o in options" :key="o.id" :value="o.id"
            class="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-fg outline-none data-[highlighted]:bg-white/[0.08]">
            <component :is="o.icon" :size="14" class="text-fg2" aria-hidden="true" />{{ o.label }}
            <DropdownMenuItemIndicator class="ml-auto"><Check :size="13" class="text-accent" /></DropdownMenuItemIndicator>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
