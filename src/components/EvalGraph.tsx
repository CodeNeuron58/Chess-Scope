import type { Classification } from '../types'
import { classificationColor } from './ClassIcon'
import './evalGraph.css'

interface Props {
  /** White eval in centipawns per position, index i = after i plies. */
  evals: number[]
  classifications: Classification[]
  currentPly: number
  onSelectPly: (ply: number) => void
}

const W = 340
const H = 96
const MAX_CP = 1000 // ±10 pawns, like chess.com's review graph

export function EvalGraph({ evals, classifications, currentPly, onSelectPly }: Props) {
  if (evals.length < 2) {
    return (
      <div className="eval-graph eval-graph--empty">
        Run a review to see the evaluation graph.
      </div>
    )
  }
  const n = evals.length - 1
  const x = (i: number) => (i / n) * (W - 34) + 30
  const clamp = (cp: number) => Math.max(-MAX_CP, Math.min(MAX_CP, cp))
  const y = (cp: number) => H / 2 - (clamp(cp) / MAX_CP) * (H / 2 - 8)

  const curve = evals.map((cp, i) => `${x(i).toFixed(1)},${y(cp).toFixed(1)}`).join(' ')

  // Area between the curve and the zero line, split into white-side and black-side polygons.
  const zero = H / 2
  const up: string[] = []
  const down: string[] = []
  evals.forEach((cp, i) => {
    const yy = y(cp)
    up.push(`${x(i)},${Math.min(yy, zero).toFixed(1)}`)
    down.push(`${x(i)},${Math.max(yy, zero).toFixed(1)}`)
  })
  const upArea = `${up.join(' ')} ${W - 4},${zero} 30,${zero}`
  const downArea = `30,${zero} ${W - 4},${zero} ${down.slice().reverse().join(' ')}`

  return (
    <div className="eval-graph">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Evaluation graph">
        <rect x={0} y={0} width={W} height={H} fill="#3c3a37" rx={6} />
        {[10, 5, -5, -10].map((v) => (
          <line
            key={v}
            x1={28}
            y1={y(v * 100)}
            x2={W - 4}
            y2={y(v * 100)}
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={1}
          />
        ))}
        <line x1={28} y1={zero} x2={W - 4} y2={zero} stroke="rgba(255,255,255,0.3)" strokeWidth={1} strokeDasharray="4 4" />
        <polygon points={upArea} fill="#f5f3ef" opacity={0.9} />
        <polygon points={downArea} fill="#191817" opacity={0.85} />
        <polyline points={curve} fill="none" stroke="#c9c6c0" strokeWidth={1.3} />
        {classifications.map((c, idx) => {
          const ply = idx + 1
          const cy = y(evals[ply] ?? 0)
          return (
            <circle
              key={ply}
              cx={x(ply)}
              cy={cy}
              r={ply === currentPly ? 4.2 : 2.6}
              fill={classificationColor(c)}
              stroke="#262421"
              strokeWidth={ply === currentPly ? 1.2 : 0}
              className="eval-graph__dot"
              onClick={() => onSelectPly(ply)}
            >
              <title>
                Move {Math.floor(idx / 2) + 1}
                {idx % 2 === 0 ? '.' : '...'} — {c}
              </title>
            </circle>
          )
        })}
        <line
          x1={x(currentPly)}
          y1={4}
          x2={x(currentPly)}
          y2={H - 4}
          stroke="rgba(255,255,255,0.55)"
          strokeWidth={1}
        />
        {[10, 5, 0, -5, -10].map((v) => (
          <text key={v} x={24} y={y(v * 100) + 3} fontSize={8.5} fill="rgba(255,255,255,0.45)" textAnchor="end">
            {v > 0 ? `+${v}` : v}
          </text>
        ))}
      </svg>
    </div>
  )
}
