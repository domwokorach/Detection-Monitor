<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import Field from '@/components/ui/Field.vue'
import Select from '@/components/ui/Select.vue'
import Toggle from '@/components/ui/Toggle.vue'
import Btn from '@/components/ui/Btn.vue'
import SliderField from '@/components/ui/SliderField.vue'
import { backend, guarded } from '@/stores/app'
import { inputCls } from '@/lib/ui'
import type { Rule, RuleKind } from '@/types'

const props = defineProps<{ rule: Rule | null }>()
const open = defineModel<boolean>('open', { required: true })
const editing = computed(() => !!props.rule)

const kinds: { value: RuleKind; label: string }[] = [
  { value: 'AMOUNT_THRESHOLD', label: 'Amount threshold' }, { value: 'COUNTRY_WATCHLIST', label: 'Country watchlist' },
  { value: 'VELOCITY', label: 'Velocity (payment count)' }, { value: 'CUMULATIVE_AMOUNT', label: 'Cumulative outflow' },
]
const form = reactive({ code: '', name: '', description: '', kind: 'AMOUNT_THRESHOLD' as RuleKind, weight: 40, enabled: true,
  minimum: '10000', countries: 'ZZ', window_minutes: 10, min_count: 3, minimum_total: '15000' })
const busy = ref(false)
const error = ref('')

watch(open, isOpen => {
  if (!isOpen) return
  error.value = ''
  const r = props.rule
  Object.assign(form, { code: '', name: '', description: '', kind: 'AMOUNT_THRESHOLD', weight: 40, enabled: true, minimum: '10000', countries: 'ZZ', window_minutes: 10, min_count: 3, minimum_total: '15000' })
  if (r) {
    const c = r.config as Record<string, unknown>
    Object.assign(form, { code: r.code, name: r.name, description: r.description, kind: r.kind, weight: r.weight, enabled: r.enabled,
      minimum: String(c.minimum ?? '10000'), countries: ((c.countries as string[]) ?? ['ZZ']).join(', '),
      window_minutes: Number(c.window_minutes ?? 10), min_count: Number(c.min_count ?? 3), minimum_total: String(c.minimum_total ?? '15000') })
  }
})

function buildConfig(): Record<string, unknown> {
  switch (form.kind) {
    case 'AMOUNT_THRESHOLD': return { minimum: form.minimum }
    case 'COUNTRY_WATCHLIST': return { countries: form.countries.split(/[\s,]+/).filter(Boolean).map(c => c.toUpperCase()) }
    case 'VELOCITY': return { window_minutes: form.window_minutes, min_count: form.min_count }
    default: return { window_minutes: form.window_minutes, minimum_total: form.minimum_total }
  }
}
const codeError = computed(() => !editing.value && form.code && !/^[A-Z][A-Z0-9_]{2,59}$/.test(form.code) ? 'Use 3–60 chars: A–Z, 0–9, underscore; start with a letter.' : '')
const valid = computed(() => form.name.trim().length >= 3 && (editing.value || (/^[A-Z][A-Z0-9_]{2,59}$/.test(form.code))))

async function save() {
  busy.value = true; error.value = ''
  const config = buildConfig()
  const result = await guarded(async () => {
    try {
      return props.rule
        ? await backend().updateRule(props.rule.id, { expected_version: props.rule.version, name: form.name.trim(), description: form.description, config, weight: form.weight, enabled: form.enabled })
        : await backend().createRule({ code: form.code, name: form.name.trim(), description: form.description, kind: form.kind, config, weight: form.weight, enabled: form.enabled })
    } catch (e) { error.value = e instanceof Error ? e.message : 'Save failed'; throw e }
  }, editing.value ? 'Rule updated' : 'Rule created')
  busy.value = false
  if (result) open.value = false
}
</script>

<template>
  <Modal v-model:open="open" :title="editing ? `Edit ${rule?.code}` : 'Create risk rule'" description="Changes are versioned and written to the audit log." width="max-w-xl">
    <form class="space-y-4" @submit.prevent="save">
      <div v-if="!editing" class="grid gap-4 sm:grid-cols-2">
        <Field label="Rule code" :error="codeError" hint="Unique identifier, e.g. HIGH_VALUE_WIRE"><template #default="{ id }"><input :id="id" v-model="form.code" :class="[inputCls, 'font-mono uppercase']" maxlength="60" autocomplete="off"></template></Field>
        <Field label="Rule type"><template #default="{ id }"><Select :id="id" v-model="form.kind" :options="kinds" label="Rule type" /></template></Field>
      </div>
      <Field label="Name"><template #default="{ id }"><input :id="id" v-model="form.name" :class="inputCls" maxlength="120" autocomplete="off"></template></Field>
      <Field label="Description"><template #default="{ id }"><textarea :id="id" v-model="form.description" rows="2" maxlength="1000" :class="inputCls" /></template></Field>

      <fieldset class="space-y-4 rounded-2xl border border-white/8 bg-white/3 p-4">
        <legend class="px-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">Thresholds</legend>
        <Field v-if="form.kind === 'AMOUNT_THRESHOLD'" label="Minimum amount (transaction currency)"><template #default="{ id }"><input :id="id" v-model="form.minimum" type="number" min="1" step="any" :class="[inputCls, 'font-mono']"></template></Field>
        <Field v-if="form.kind === 'COUNTRY_WATCHLIST'" label="Country codes" hint="Two-letter codes, comma separated."><template #default="{ id }"><input :id="id" v-model="form.countries" :class="[inputCls, 'font-mono uppercase']"></template></Field>
        <SliderField v-if="form.kind === 'VELOCITY' || form.kind === 'CUMULATIVE_AMOUNT'" v-model="form.window_minutes" label="Window" :min="1" :max="1440" unit="min" />
        <SliderField v-if="form.kind === 'VELOCITY'" v-model="form.min_count" label="Minimum payment count" :min="2" :max="50" />
        <Field v-if="form.kind === 'CUMULATIVE_AMOUNT'" label="Minimum cumulative total"><template #default="{ id }"><input :id="id" v-model="form.minimum_total" type="number" min="1" step="any" :class="[inputCls, 'font-mono']"></template></Field>
        <SliderField v-model="form.weight" label="Risk weight (added to score)" :min="1" :max="100" />
      </fieldset>

      <div class="flex items-center justify-between rounded-xl border border-white/8 px-4 py-3">
        <span class="text-sm text-slate-200">Enabled</span><Toggle v-model="form.enabled" label="Rule enabled" />
      </div>
      <p v-if="error" class="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200" role="alert">{{ error }}</p>
      <div class="flex justify-end gap-2 pt-1">
        <Btn variant="ghost" @click="open = false">Cancel</Btn>
        <Btn variant="primary" type="submit" :loading="busy" :disabled="!valid">{{ editing ? 'Save changes' : 'Create rule' }}</Btn>
      </div>
    </form>
  </Modal>
</template>
