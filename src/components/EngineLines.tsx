import type { EngineLine } from '../types'
import { formatEval } from '../analysis/accuracy'
import './engineLines.css'

interface Props {
  lines: EngineLine[]
  depth: number
  /** Position index the lines belong to. */
  ply: number
}

function sanLine(pvSan: string[], ply: number): string {
  const startNum = Math.floor(ply / 2) + 1
  const whiteToMove = ply % 2 === 0
  const parts: string[] = []
  let num = startNum
  let i = 0
  if (!whiteToMove && pvSan.length > 0) {
    parts.push(`${num}... ${pvSan[0]}`)
    i = 1
    num++
  }
  while (i < pvSan.length) {
    const white = pvSan[i]
    const black = pvSan[i + 1]
    if (black !== undefined) parts.push(`${num}. ${white} ${black}`)
    else parts.push(`${num}. ${white}`)
    i += 2
    num++
  }
  return parts.join(' ')
}

export function EngineLines({ lines, depth, ply }: Props) {
  if (lines.length === 0) {
    return (
      <div className="engine-lines engine-lines--empty">
        Engine lines appear here after a review.
      </div>
    )
  }
  return (
    <div className="engine-lines">
      <div className="engine-lines__head">Engine lines · depth {depth}</div>
      {lines.map((line, idx) => (
        <div className={`engine-line ${idx === 0 ? 'engine-line--best' : ''}`} key={idx}>
          <span className={`engine-line__eval ${line.whiteCp >= 0 ? '' : 'engine-line__eval--neg'}`}>
            {formatEval(line.whiteCp, line.mateIn)}
          </span>
          <span className="engine-line__pv">{sanLine(line.pvSan, ply)}</span>
        </div>
      ))}
    </div>
  )
}
