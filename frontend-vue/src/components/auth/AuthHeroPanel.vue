<script setup lang="ts">
import { motion } from 'motion-v'
import { ShieldCheck } from 'lucide-vue-next'

/** Left column of the sign-in page. Artwork is decorative (aria-hidden); identity comes from the real text.
 *  The two chips are product capability labels, not a connection state. Reduced motion is honoured by MotionConfig in App.vue. */
const EASE = [0.22, 1, 0.36, 1] as const
const rise = (i: number) => ({ initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, ease: EASE, delay: 0.15 + i * 0.11 } })
</script>

<template>
  <section aria-label="Detection-monitor" class="relative isolate flex min-h-[19rem] items-center overflow-hidden border-b border-[#1B344D] bg-[#071426] text-[#F2F7FC] lg:min-h-screen lg:border-r lg:border-b-0">
    <div aria-hidden="true" class="pointer-events-none absolute inset-0 -z-10 select-none">
      <!-- Premium cyan ambient lighting -->
      <div class="pointer-events-none absolute -right-20 top-1/4 size-80 rounded-full bg-sky-500/15 blur-3xl" />
      <!-- Futuristic shield background -->
      <motion.img src="/images/detection-shield.png" alt="" aria-hidden="true" decoding="async" draggable="false"
        :initial="{ opacity: 0, scale: 1.06 }" :animate="{ opacity: 0.32, scale: 1 }" :transition="{ duration: 1.4, ease: EASE }"
        class="pointer-events-none absolute right-[-16%] top-1/2 z-0 w-[110%] max-w-[850px] -translate-y-1/2 object-contain select-none max-sm:w-[140%]" />
      <!-- Dark overlay for readable text -->
      <div class="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-r from-[#030B14]/95 via-[#071426]/70 to-[#071426]/25" />
      <div class="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#65B9EE]/35 to-transparent" />
    </div>

    <div class="relative z-10 w-full px-6 py-10 sm:px-10 lg:px-14 xl:px-20">
      <motion.p v-bind="rise(0)" class="text-[17px] font-semibold" style="font-family: 'Geist', 'Inter', ui-sans-serif, system-ui, sans-serif">Detection-monitor</motion.p>
      <motion.h1 v-bind="rise(1)" class="mt-8 text-[34px] leading-[1.1] font-semibold tracking-[-1.5px] sm:text-[44px] lg:mt-12 lg:text-[52px] xl:text-[60px]" style="font-family: 'Geist', 'Inter', ui-sans-serif, system-ui, sans-serif">
        Catch detection<br><span class="text-[#BFE8FF]">before it settles.</span>
      </motion.h1>
      <motion.p v-bind="rise(2)" class="mt-5 max-w-[480px] text-sm leading-[1.75] text-[#8CA2BA] sm:text-[15px]">
        Event-time rule screening, analyst case management and a tamper-evident audit trail in one workspace.
      </motion.p>
      <motion.ul v-bind="rise(3)" class="mt-7 flex flex-wrap items-center gap-2 text-xs" aria-label="Capabilities">
        <li class="group flex items-center gap-2 rounded-[5px] border border-[#1B344D] px-3 py-1.5 text-[#BFE8FF] transition-colors duration-300 hover:bg-[#0B1E33]">
          <span aria-hidden="true" class="size-1.5 rounded-full bg-[#65B9EE] shadow-[0_0_6px_rgba(101,185,238,0.55)] transition-shadow duration-300 group-hover:shadow-[0_0_10px_2px_rgba(101,185,238,0.7)]" />
          <span class="font-medium">Live screening</span>
        </li>
        <li aria-hidden="true" class="text-[#1B344D]">·</li>
        <li class="group flex items-center gap-2 rounded-[5px] border border-[#1B344D] px-3 py-1.5 text-[#8CA2BA] transition-colors duration-300 hover:bg-[#0B1E33]">
          <ShieldCheck :size="14" aria-hidden="true" class="text-[#BFE8FF]/80 transition-colors duration-300 group-hover:text-[#BFE8FF]" />
          <span class="font-medium transition-colors duration-300 group-hover:text-[#BFE8FF]">Audit-ready</span>
        </li>
      </motion.ul>
    </div>
  </section>
</template>
