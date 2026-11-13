<script setup lang="ts">
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle, DialogDescription, DialogClose } from 'reka-ui'
import { AnimatePresence, motion } from 'motion-v'
import { X } from 'lucide-vue-next'

defineProps<{ title: string; description?: string; width?: string }>()
const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal force-mount>
      <AnimatePresence>
        <DialogOverlay v-if="open" as-child force-mount>
          <motion.div :initial="{ opacity: 0 }" :animate="{ opacity: 1 }" :exit="{ opacity: 0 }" :transition="{ duration: 0.18 }"
            class="fixed inset-0 z-40 bg-ink-950/70 backdrop-blur-sm" />
        </DialogOverlay>
      </AnimatePresence>
      <AnimatePresence>
        <DialogContent v-if="open" as-child force-mount>
          <motion.div
            :initial="{ x: '100%' }" :animate="{ x: 0 }" :exit="{ x: '100%' }"
            :transition="{ type: 'spring', stiffness: 420, damping: 38 }"
            class="glass fixed inset-y-0 right-0 z-50 flex w-full flex-col rounded-l-3xl border-r-0 bg-ink-800/95 outline-none"
            :class="width ?? 'max-w-xl'"
          >
            <header class="flex items-start justify-between gap-4 border-b border-white/8 p-5">
              <div class="min-w-0">
                <DialogTitle class="truncate text-base font-semibold text-white">{{ title }}</DialogTitle>
                <DialogDescription v-if="description" class="mt-0.5 text-xs text-slate-400">{{ description }}</DialogDescription>
                <DialogDescription v-else class="sr-only">Details panel</DialogDescription>
              </div>
              <DialogClose class="focus-ring rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Close panel">
                <X :size="18" />
              </DialogClose>
            </header>
            <div class="flex-1 overflow-y-auto p-5"><slot /></div>
            <footer v-if="$slots.footer" class="border-t border-white/8 p-4"><slot name="footer" /></footer>
          </motion.div>
        </DialogContent>
      </AnimatePresence>
    </DialogPortal>
  </DialogRoot>
</template>
