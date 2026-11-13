<script setup lang="ts">
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle, DialogDescription, DialogClose } from 'reka-ui'
import { AnimatePresence, motion } from 'motion-v'
import { X } from 'lucide-vue-next'

defineProps<{ title: string; description: string; width?: string }>()
const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal force-mount>
      <AnimatePresence>
        <DialogOverlay v-if="open" as-child force-mount>
          <motion.div :initial="{ opacity: 0 }" :animate="{ opacity: 1 }" :exit="{ opacity: 0 }" :transition="{ duration: 0.18 }"
            class="fixed inset-0 z-40 bg-ink-950/75 backdrop-blur-sm" />
        </DialogOverlay>
      </AnimatePresence>
      <AnimatePresence>
        <DialogContent v-if="open" as-child force-mount>
          <motion.div
            :initial="{ opacity: 0, scale: 0.94, y: 12 }" :animate="{ opacity: 1, scale: 1, y: 0 }" :exit="{ opacity: 0, scale: 0.96, y: 8 }"
            :transition="{ type: 'spring', stiffness: 480, damping: 34 }"
            class="glass fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl bg-ink-800/95 p-6 outline-none"
            :class="width ?? 'max-w-lg'"
          >
            <div class="mb-5 flex items-start justify-between gap-4">
              <div>
                <DialogTitle class="text-base font-semibold text-white">{{ title }}</DialogTitle>
                <DialogDescription class="mt-1 text-sm text-slate-400">{{ description }}</DialogDescription>
              </div>
              <DialogClose class="focus-ring rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Close dialog"><X :size="18" /></DialogClose>
            </div>
            <slot />
          </motion.div>
        </DialogContent>
      </AnimatePresence>
    </DialogPortal>
  </DialogRoot>
</template>
