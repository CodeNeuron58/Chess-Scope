import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Classification } from '../types'
import { CLASS_STYLE } from '../lib/constants'
import type { GameResult } from '../library/types'

/** Pill segmented control. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  variant,
  size,
  label,
}: {
  options: { value: T; label: ReactNode; title?: string }[]
  value: T
  onChange: (v: T) => void
  variant?: 'raised'
  size?: 'sm' | 'tight'
  label?: string
}) {
  return (
    <div className={`seg ${variant ? `seg--${variant}` : ''} ${size ? `seg--${size}` : ''}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          title={o.title}
          className={`seg__opt ${o.value === value ? 'seg__opt--on' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ on, onChange, label, size }: { on: boolean; onChange: (v: boolean) => void; label: string; size?: 'sm' }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`toggle ${on ? 'toggle--on' : ''} ${size ? `toggle--${size}` : ''}`}
      onClick={() => onChange(!on)}
    />
  )
}

/** Popover anchored to a trigger; closes on outside click or Escape. */
export function Popover({
  trigger,
  children,
  width,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode
  children: (close: () => void) => ReactNode
  width?: number
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <div className="menu-anchor" ref={ref}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div className="menu" role="menu" style={width ? { width } : undefined}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className={`modal ${wide ? 'modal--wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <span className="modal__title">{title}</span>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Coloured classification chip ("??", "★" …). */
export function ClassChip({ cls, size = 'md' }: { cls: Classification; size?: 'md' | 'lg' }) {
  const s = CLASS_STYLE[cls]
  return (
    <span
      className="class-chip"
      title={`${s.label} — ${s.desc}`}
      style={{ background: s.color, ...(size === 'lg' ? { height: 22, minWidth: 26, fontSize: 11 } : null) }}
    >
      {s.glyph}
    </span>
  )
}

/** Result from the user's side (W/L/D) or the bare score when the side is unknown. */
export function ResultChip({ outcome, result }: { outcome: 'W' | 'L' | 'D' | null; result: GameResult }) {
  if (outcome) return <span className={`result-chip result-chip--${outcome}`}>{outcome}</span>
  const label = result === '1/2-1/2' ? '½' : result === '*' ? '·' : result
  return <span className={`result-chip result-chip--N`}>{label}</span>
}

export function ErrorChips({ blunders, mistakes, dim }: { blunders: number | null; mistakes: number | null; dim?: boolean }) {
  return (
    <div className="err-chips" style={dim ? { opacity: 0.35 } : undefined}>
      <span className="err-chip err-chip--blunder">?? {blunders ?? '–'}</span>
      <span className="err-chip err-chip--mistake">? {mistakes ?? '–'}</span>
    </div>
  )
}

export function AccuracyCell({ value }: { value: number | null | undefined }) {
  const ok = value !== null && value !== undefined && !Number.isNaN(value)
  return (
    <div className="acc-cell">
      <b>{ok ? value.toFixed(1) : '—'}</b>
      <span className="meter">
        <span className="meter__fill" style={{ width: ok ? `${value}%` : '0%' }} />
      </span>
    </div>
  )
}
