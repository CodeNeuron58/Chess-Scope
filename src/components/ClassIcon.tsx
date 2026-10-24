import type { Classification } from '../types'
import './classIcons.css'

const CONFIG: Record<Classification, { glyph: string; color: string; label: string }> = {
  brilliant: { glyph: '!!', color: '#1baca6', label: 'Brilliant — a great sacrifice' },
  great: { glyph: '!', color: '#5c8bb0', label: 'Great — a critical move that altered the course of the game' },
  best: { glyph: '★', color: '#81b64c', label: 'Best move' },
  excellent: { glyph: '✓', color: '#96bc4b', label: 'Excellent' },
  good: { glyph: '✓', color: '#96af8b', label: 'Good — fine, but better moves existed' },
  book: { glyph: 'B', color: '#a88865', label: 'Book — a standard opening move' },
  forced: { glyph: '→', color: '#96af8b', label: 'Forced — the only legal move' },
  inaccuracy: { glyph: '?!', color: '#f7c631', label: 'Inaccuracy — a weak move, not as good as the best' },
  mistake: { glyph: '?', color: '#ffa459', label: 'Mistake — a bad move that immediately worsens your position' },
  miss: { glyph: '✕', color: '#fa412d', label: 'Miss — a winning chance was lost' },
  blunder: { glyph: '??', color: '#fa412d', label: 'Blunder — significantly worsens the position' },
}

export function classificationColor(c: Classification): string {
  return CONFIG[c].color
}

export function ClassIcon({ classification, size = 15 }: { classification: Classification; size?: number }) {
  const cfg = CONFIG[classification]
  return (
    <span
      className="class-icon"
      title={cfg.label}
      style={{ color: cfg.color, fontSize: size, width: size * 1.35, height: size * 1.15 }}
      aria-label={cfg.label}
    >
      {cfg.glyph}
    </span>
  )
}
