import { reactive } from 'vue'
import { backend } from '@/stores/app'
import type { AlertDetail } from '@/types'

const cache = reactive(new Map<string, AlertDetail>())
const inflight = new Set<string>()

/** Lazily loads (and caches) alert detail so dashboard tables can show the matched rule. */
export function ensureDetails(ids: string[]) {
  for (const id of ids) {
    if (cache.has(id) || inflight.has(id)) continue
    inflight.add(id)
    backend().alert(id).then(d => cache.set(id, d)).catch(() => { /* row falls back to a generic label */ }).finally(() => inflight.delete(id))
  }
}
export const detailFor = (id: string) => cache.get(id)
