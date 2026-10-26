import { useMemo, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import { Chess, type Square } from 'chess.js'
import type { Classification } from '../types'
import { BOARD_THEMES, CLASS_STYLE, pieceUrl, type PieceSetKey } from '../lib/constants'
import { useApp } from '../state/context'
import './board.css'

export interface BoardArrow {
  from: string
  to: string
  color?: string
}

export interface BoardMark {
  square: string
  cls: Classification
}

interface Props {
  fen: string
  width: number
  orientation: 'white' | 'black'
  lastMove?: { from: string; to: string } | null
  arrows?: BoardArrow[]
  mark?: BoardMark | null
  /** Squares outlined with a coloured ring (hints, hanging pieces). */
  rings?: Record<string, string>
  interactive?: boolean
  /** Return true when the move was accepted. */
  onMove?: (from: string, to: string, promotion?: string) => boolean
  overlay?: React.ReactNode
}

const CODES = ['wP', 'wN', 'wB', 'wR', 'wQ', 'wK', 'bP', 'bN', 'bB', 'bR', 'bQ', 'bK'] as const

function usePieceRenderers(set: PieceSetKey) {
  return useMemo(
    () =>
      Object.fromEntries(
        CODES.map((code) => [
          code,
          ({ squareWidth }: { squareWidth: number }) => (
            <img src={pieceUrl(set, code)} width={squareWidth} height={squareWidth} draggable={false} alt="" style={{ display: 'block' }} />
          ),
        ]),
      ),
    [set],
  )
}

/** Square centre in board units (0-8), honouring orientation. */
function centre(square: string, orientation: 'white' | 'black'): [number, number] {
  const file = square.charCodeAt(0) - 97
  const rank = Number(square[1])
  return orientation === 'white' ? [file + 0.5, 8 - rank + 0.5] : [7 - file + 0.5, rank - 1 + 0.5]
}

function ArrowShape({ arrow, orientation, fallback }: { arrow: BoardArrow; orientation: 'white' | 'black'; fallback: string }) {
  const [fx, fy] = centre(arrow.from, orientation)
  const [tx, ty] = centre(arrow.to, orientation)
  const dx = tx - fx
  const dy = ty - fy
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const nx = -uy
  const ny = ux
  const ex = tx - ux * 0.12
  const ey = ty - uy * 0.12
  const hx = ex - ux * 0.44
  const hy = ey - uy * 0.44
  const color = arrow.color ?? fallback
  return (
    <g style={{ opacity: 0.85 }}>
      <line x1={fx} y1={fy} x2={hx} y2={hy} stroke={color} strokeWidth={0.17} strokeLinecap="round" />
      <polygon points={`${ex},${ey} ${hx + nx * 0.26},${hy + ny * 0.26} ${hx - nx * 0.26},${hy - ny * 0.26}`} fill={color} />
    </g>
  )
}

/** The interactive board: drag or click to move, design arrows and classification marks on top. */
export function Board({ fen, width, orientation, lastMove, arrows = [], mark, rings, interactive = false, onMove, overlay }: Props) {
  const { settings } = useApp()
  const theme = BOARD_THEMES[settings.boardTheme] ?? BOARD_THEMES.forest
  const pieces = usePieceRenderers(settings.pieceSet)
  const [selected, setSelected] = useState<{ fen: string; square: string } | null>(null)
  const sel = selected && selected.fen === fen ? selected.square : null

  const targets = useMemo(() => {
    if (!sel) return []
    try {
      return new Chess(fen).moves({ square: sel as Square, verbose: true }).map((m) => m.to as string)
    } catch {
      return []
    }
  }, [fen, sel])

  const squareStyles = useMemo(() => {
    const s: Record<string, Record<string, string>> = {}
    if (lastMove) {
      s[lastMove.from] = { background: theme.highlight }
      s[lastMove.to] = { background: theme.highlight }
    }
    if (sel) s[sel] = { ...s[sel], background: 'rgba(159,212,178,0.45)' }
    for (const t of targets) {
      s[t] = { ...s[t], backgroundImage: 'radial-gradient(circle, rgba(16,28,22,0.32) 18%, transparent 20%)' }
    }
    for (const [sq, color] of Object.entries(rings ?? {})) s[sq] = { ...s[sq], boxShadow: `inset 0 0 0 4px ${color}` }
    return s
  }, [lastMove, sel, targets, rings, theme.highlight])

  const tryMove = (from: string, to: string, promotion?: string) => {
    if (!interactive || !onMove) return false
    return onMove(from, to, promotion)
  }

  const onSquareClick = (square: Square) => {
    if (!interactive) return
    if (sel && targets.includes(square)) {
      const piece = (() => {
        try {
          return new Chess(fen).get(sel as Square)
        } catch {
          return undefined
        }
      })()
      const promo = piece?.type === 'p' && (square[1] === '8' || square[1] === '1') ? 'q' : undefined
      tryMove(sel, square, promo)
      setSelected(null)
      return
    }
    let own = false
    try {
      const c = new Chess(fen)
      const p = c.get(square)
      own = !!p && p.color === c.turn()
    } catch {
      own = false
    }
    setSelected(own && sel !== square ? { fen, square } : null)
  }

  const markStyle = CLASS_STYLE[mark?.cls ?? 'best']
  const sq = width / 8
  const chip = Math.max(15, width * 0.044)
  const markPos = mark ? centre(mark.square, orientation) : null

  return (
    <div className="board" style={{ width, height: width }}>
      <Chessboard
        position={fen}
        boardWidth={width}
        boardOrientation={orientation}
        customPieces={pieces}
        customLightSquareStyle={{ backgroundColor: theme.light }}
        customDarkSquareStyle={{ backgroundColor: theme.dark }}
        customSquareStyles={squareStyles}
        customBoardStyle={{ borderRadius: '6px' }}
        customNotationStyle={{ fontSize: `${Math.max(8, width * 0.019)}px`, fontWeight: '600', fontFamily: 'var(--font)' }}
        customDropSquareStyle={{ boxShadow: 'inset 0 0 0 4px rgba(159,212,178,0.75)' }}
        showBoardNotation={settings.coords}
        animationDuration={settings.animate ? 180 : 0}
        arePiecesDraggable={interactive}
        areArrowsAllowed={false}
        onPieceDrop={(from, to, piece) => {
          setSelected(null)
          const promo = piece[1]?.toLowerCase()
          const isPawnPromo = (to[1] === '8' || to[1] === '1') && (() => {
            try {
              return new Chess(fen).get(from)?.type === 'p'
            } catch {
              return false
            }
          })()
          return tryMove(from, to, isPawnPromo ? (promo && 'qrbn'.includes(promo) ? promo : 'q') : undefined)
        }}
        onSquareClick={onSquareClick}
      />
      <svg className="board__arrows" viewBox="0 0 8 8" aria-hidden="true">
        {arrows.map((a, i) => (
          <ArrowShape key={`${a.from}${a.to}${i}`} arrow={a} orientation={orientation} fallback={theme.arrow} />
        ))}
      </svg>
      {mark && markPos && (
        <span
          className="board__mark"
          title={markStyle.label}
          style={{
            left: (markPos[0] + 0.5) * sq - sq * 0.03 - chip,
            top: (markPos[1] - 0.5) * sq + sq * 0.03,
            minWidth: chip,
            height: chip,
            fontSize: Math.max(9, width * 0.023),
            background: markStyle.color,
            color: mark.cls === 'good' || mark.cls === 'inaccuracy' || mark.cls === 'best' || mark.cls === 'excellent' || mark.cls === 'book' ? '#1a1a1a' : '#fff',
          }}
        >
          {markStyle.glyph}
        </span>
      )}
      {overlay}
    </div>
  )
}
