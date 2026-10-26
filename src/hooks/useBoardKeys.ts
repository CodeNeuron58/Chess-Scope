import { useEffect, useRef } from 'react'

export interface BoardKeyHandlers {
  prev?: () => void
  next?: () => void
  first?: () => void
  last?: () => void
  flip?: () => void
  threat?: () => void
  escape?: () => void
}

/** ← → / ↑ ↓ step, Home / End jump, F flip, X threat, Esc close. Ignored while typing. */
export function useBoardKeys(handlers: BoardKeyHandlers, enabled = true) {
  const ref = useRef(handlers)
  useEffect(() => {
    ref.current = handlers
  })
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const h = ref.current
      const run = (fn?: () => void) => {
        if (!fn) return
        e.preventDefault()
        fn()
      }
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          run(h.prev)
          break
        case 'ArrowRight':
        case 'ArrowDown':
          run(h.next)
          break
        case 'Home':
          run(h.first)
          break
        case 'End':
          run(h.last)
          break
        case 'f':
        case 'F':
          run(h.flip)
          break
        case 'x':
        case 'X':
          run(h.threat)
          break
        case 'Escape':
          h.escape?.()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}
