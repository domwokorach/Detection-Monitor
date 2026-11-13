<script setup lang="ts">
import { ref } from 'vue'
import { motion } from 'motion-v'
import { Sparkles } from 'lucide-vue-next'
import { enterDemo, login } from '@/stores/app'
import { ApiError } from '@/services/http'
import { inputCls } from '@/lib/ui'
import AuthHeroPanel from '@/components/auth/AuthHeroPanel.vue'
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
  <main class="grid min-h-screen grid-cols-1 lg:grid-cols-[55fr_45fr] [&>*]:min-w-0">
    <AuthHeroPanel />

      <motion.section :initial="{ opacity: 0, y: 16 }" :animate="{ opacity: 1, y: 0 }" :transition="{ duration: 0.35, delay: 0.08 }" class="mx-auto flex w-full max-w-md flex-col justify-center p-6 sm:p-10 lg:p-12">
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
  </main>
</template>
