import type { Classification } from '../types'
import { CLASS_STYLE } from '../lib/constants'
import { winPercent } from '../analysis/accuracy'
import { moveLabel } from '../library/stats'
import './evalGraph.css'

interface Props {
  /** White eval in centipawns per position (index i = after i plies). */
  evals: number[]
  classifications: Classification[]
  sans: string[]
  currentPly: number
  onSelectPly: (ply: number) => void
  height?: number
}

const QUIET: Classification[] = ['best', 'excellent', 'good', 'book', 'forced']
const W = 330

/**
 * Winning-chances graph (White's share, an S-curve like chess.com's): small
 * edges stay visible and decided positions flatten out. Notable moves are
 * marked with their classification colour.
 */
export function EvalGraph({ evals, classifications, sans, currentPly, onSelectPly, height = 84 }: Props) {
  const n = Math.max(1, evals.length - 1)
  const x = (i: number) => (i / n) * W
  // keep a sliver of each colour visible even in won positions
  const y = (cp: number) => 98 - (winPercent(cp) / 100) * 96
  const pts = evals.map((cp, i) => `${x(i).toFixed(1)},${y(cp).toFixed(1)}`).join(' L')
  const area = `M0,100 L${pts} L${W},100 Z`

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    onSelectPly(Math.max(0, Math.min(n, Math.round(((e.clientX - r.left) / r.width) * n))))
  }

  return (
    <div className="eval-graph" style={{ height }} onClick={onClick} title="Click to jump to a move" role="img" aria-label="Evaluation graph">
      <svg viewBox={`0 0 ${W} 100`} preserveAspectRatio="none">
        <path d={area} fill="var(--text)" fillOpacity={0.88} />
        <line x1={0} y1={50} x2={W} y2={50} stroke="#3f5a4c" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        <line x1={x(currentPly)} y1={0} x2={x(currentPly)} y2={100} stroke="var(--accent)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
      {classifications.map((c, idx) => {
        if (QUIET.includes(c)) return null
        const ply = idx + 1
        return (
          <span
            key={ply}
            className="eval-graph__dot"
            title={`${moveLabel(ply, sans[idx] ?? '')} · ${CLASS_STYLE[c].label}`}
            style={{ left: `${(ply / n) * 100}%`, top: `${y(evals[ply] ?? 0)}%`, background: CLASS_STYLE[c].color }}
          />
        )
      })}
    </div>
  )
}
