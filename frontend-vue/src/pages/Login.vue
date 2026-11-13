<script setup lang="ts">
import { ref } from 'vue'
import { motion } from 'motion-v'
import { ShieldCheck, Activity, Fingerprint, Sparkles } from 'lucide-vue-next'
import { enterDemo, login } from '@/stores/app'
import { ApiError } from '@/services/http'
import { inputCls } from '@/lib/ui'
import Btn from '@/components/ui/Btn.vue'
import Field from '@/components/ui/Field.vue'

const email = ref('admin@demo.local')
const password = ref('')
const error = ref('')
const unreachable = ref(false)
const busy = ref(false)

async function submit() {
  busy.value = true; error.value = ''; unreachable.value = false
  try { await login(email.value, password.value) }
  catch (e) {
    error.value = e instanceof Error ? e.message : 'Sign in failed'
    unreachable.value = e instanceof ApiError && e.status === 0
  } finally { busy.value = false }
}
</script>

<template>
  <main class="grid min-h-screen place-items-center px-4 py-10">
    <div class="grid w-full max-w-5xl overflow-hidden rounded-3xl lg:grid-cols-2 glass">
      <motion.section :initial="{ opacity: 0, x: -20 }" :animate="{ opacity: 1, x: 0 }" :transition="{ duration: 0.4 }" class="relative hidden flex-col justify-between overflow-hidden p-10 lg:flex">
        <div class="pointer-events-none absolute -top-20 -left-20 size-72 rounded-full bg-violet-500/30 blur-3xl" /><div class="pointer-events-none absolute -right-16 -bottom-24 size-72 rounded-full bg-cyan-400/20 blur-3xl" />
        <div class="relative flex items-center gap-3"><div class="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-violet-400 to-cyan-300"><ShieldCheck :size="20" class="text-ink-900" aria-hidden="true" /></div><span class="text-xl font-semibold text-white">Detection-monitor</span></div>
        <div class="relative"><h1 class="text-4xl leading-tight font-semibold tracking-tight text-white">Catch detection<br>before it settles.</h1>
          <p class="mt-4 max-w-sm text-slate-300">Event-time rule screening, analyst case management and a tamper-evident audit trail in one workspace.</p>
          <div class="mt-6 flex flex-wrap gap-3 text-xs text-slate-300"><span class="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5"><Activity :size="13" aria-hidden="true" /> Live screening</span><span class="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5"><Fingerprint :size="13" aria-hidden="true" /> Audit-ready</span></div></div>
      </motion.section>

      <motion.section :initial="{ opacity: 0, y: 16 }" :animate="{ opacity: 1, y: 0 }" :transition="{ duration: 0.35, delay: 0.08 }" class="bg-ink-800/60 p-8 sm:p-10">
        <h2 class="text-xl font-semibold text-white">Sign in</h2>
        <p class="mt-1 text-sm text-slate-400">Use your analyst or administrator account.</p>
        <form class="mt-6 space-y-4" @submit.prevent="submit">
          <Field label="Email"><template #default="{ id }"><input :id="id" v-model="email" type="email" autocomplete="username" required :class="inputCls"></template></Field>
          <Field label="Password"><template #default="{ id }"><input :id="id" v-model="password" type="password" autocomplete="current-password" required :class="inputCls"></template></Field>
          <p v-if="error" class="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200" role="alert">{{ error }}</p>
          <Btn type="submit" variant="primary" class="w-full" :loading="busy">Sign in</Btn>
        </form>
        <div class="my-6 flex items-center gap-3 text-xs text-slate-500"><span class="h-px flex-1 bg-white/10" />or<span class="h-px flex-1 bg-white/10" /></div>
        <Btn class="w-full" @click="enterDemo()"><Sparkles :size="15" /> Explore with demo data</Btn>
        <p class="mt-2 text-center text-xs" :class="unreachable ? 'text-amber-300' : 'text-slate-500'">{{ unreachable ? 'The backend looks offline — you can still explore with simulated data.' : 'No backend needed. Data is simulated and clearly labelled.' }}</p>
      </motion.section>
    </div>
  </main>
</template>
