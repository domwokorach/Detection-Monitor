import { useEffect, useRef, useState } from 'react'

/** IDs that appeared between polls, held for `ms` so rows can glow briefly. The first load is never "new". */
export function useFreshIds(ids: string[], ms = 5000): Set<string> {
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  const known = useRef<Set<string> | null>(null)
  const timers = useRef<number[]>([])
  useEffect(() => {
    const current = new Set(ids)
    if (known.current && ids.length) {
      const added = ids.filter(id => !known.current!.has(id))
      if (added.length) {
        setFresh(p => new Set([...p, ...added]))
        timers.current.push(window.setTimeout(() => setFresh(p => { const n = new Set(p); added.forEach(i => n.delete(i)); return n }), ms))
      }
    }
    if (ids.length || known.current) known.current = current
  }, [ids, ms])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  return fresh
}
