import { useMemo } from 'react'
import { BOARD_THEMES, pieceUrl, type BoardThemeKey, type PieceSetKey } from '../lib/constants'
import { useApp } from '../state/context'
import type { BoardArrow } from './Board'
import './board.css'

interface Props {
  fen: string
  orientation?: 'white' | 'black'
  coords?: boolean
  lastMove?: { from: string; to: string } | null
  arrows?: BoardArrow[]
  /** Override the user's appearance settings (settings preview). */
  theme?: BoardThemeKey
  pieces?: PieceSetKey
}

const FILES = 'abcdefgh'

/** Read-only board rendered as a CSS grid — cheap enough for cards and previews. */
export function StaticBoard({ fen, orientation = 'white', coords = false, lastMove, arrows = [], theme, pieces }: Props) {
  const { settings } = useApp()
  const th = BOARD_THEMES[theme ?? settings.boardTheme] ?? BOARD_THEMES.forest
  const set = pieces ?? settings.pieceSet

  const board = useMemo(() => {
    const out: Record<string, string> = {}
    const rows = fen.split(' ')[0]?.split('/') ?? []
    rows.forEach((row, r) => {
      let f = 0
      for (const ch of row) {
        if (/\d/.test(ch)) f += Number(ch)
        else {
          out[`${FILES[f]}${8 - r}`] = ch
          f++
        }
      }
    })
    return out
  }, [fen])

  const flip = orientation === 'black'
  const squares = []
  for (let ri = 0; ri < 8; ri++) {
    for (let ci = 0; ci < 8; ci++) {
      const rank = flip ? ri + 1 : 8 - ri
      const fi = flip ? 7 - ci : ci
      const sq = `${FILES[fi]}${rank}`
      const light = (fi + rank) % 2 === 0 // a1 (0 + 1) is dark
      const pc = board[sq]
      const hl = lastMove && (sq === lastMove.from || sq === lastMove.to)
      const code = pc ? `${pc === pc.toUpperCase() ? 'w' : 'b'}${pc.toUpperCase()}` : ''
      squares.push(
        <div key={sq} className="mini-board__sq" style={{ background: light ? th.light : th.dark }}>
          {hl && <div style={{ position: 'absolute', inset: 0, background: th.highlight }} />}
          {code && <img src={pieceUrl(set, code)} alt="" draggable={false} />}
          {coords && ci === 0 && (
            <span className="mini-board__coord mini-board__coord--rank" style={{ color: light ? th.dark : th.light }}>
              {rank}
            </span>
          )}
          {coords && ri === 7 && (
            <span className="mini-board__coord mini-board__coord--file" style={{ color: light ? th.dark : th.light }}>
              {FILES[fi]}
            </span>
          )}
        </div>,
      )
    }
  }

  const centre = (s: string): [number, number] => {
    const f = s.charCodeAt(0) - 97
    const r = Number(s[1])
    return flip ? [7 - f + 0.5, r - 1 + 0.5] : [f + 0.5, 8 - r + 0.5]
  }

  return (
    <div className="mini-board" aria-hidden="true">
      {squares}
      {arrows.length > 0 && (
        <svg className="board__arrows" viewBox="0 0 8 8">
          {arrows.map((a) => {
            const [fx, fy] = centre(a.from)
            const [tx, ty] = centre(a.to)
            const len = Math.hypot(tx - fx, ty - fy) || 1
            const ux = (tx - fx) / len
            const uy = (ty - fy) / len
            const ex = tx - ux * 0.12
            const ey = ty - uy * 0.12
            const hx = ex - ux * 0.44
            const hy = ey - uy * 0.44
            const c = a.color ?? th.arrow
            return (
              <g key={a.from + a.to} style={{ opacity: 0.85 }}>
                <line x1={fx} y1={fy} x2={hx} y2={hy} stroke={c} strokeWidth={0.17} strokeLinecap="round" />
                <polygon points={`${ex},${ey} ${hx - uy * 0.26},${hy + ux * 0.26} ${hx + uy * 0.26},${hy - ux * 0.26}`} fill={c} />
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}
