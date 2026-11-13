import { reactive } from 'vue'

export type Toast = { id: number; tone: 'success' | 'error' | 'info' | 'warning'; title: string; body?: string }
export const toasts = reactive<Toast[]>([])
let next = 1

export function dismissToast(id: number) {
  const i = toasts.findIndex(t => t.id === id)
  if (i >= 0) toasts.splice(i, 1)
}

export function notify(tone: Toast['tone'], title: string, body?: string, ms = 5000) {
  const id = next++
  toasts.push({ id, tone, title, body })
  if (toasts.length > 4) toasts.shift()
  setTimeout(() => dismissToast(id), ms)
}
