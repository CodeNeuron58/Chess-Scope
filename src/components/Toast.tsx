import { useEffect, useRef } from 'react'

/** Transient status pill. Re-key it to show a new message. */
export function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })
  useEffect(() => {
    const t = setTimeout(() => done.current(), 2200)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="toast" role="status" aria-live="polite">
      {text}
    </div>
  )
}
