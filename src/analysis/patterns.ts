import { Chess } from 'chess.js'
import type { EngineLine } from '../types'

const PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3.25, r: 5, q: 9, k: 100 }

/** Legal moves of `color` in a FEN, with the turn field swapped to `color`. */
function movesForTurn(fen: string, color: 'w' | 'b'): { from: string; to: string; piece: string }[] {
  const parts = fen.split(' ')
  if (parts.length < 2) return []
  parts[1] = color
  try {
    return new Chess(parts.join(' '))
      .moves({ verbose: true })
      .map((m) => ({ from: m.from, to: m.to, piece: m.piece }))
  } catch {
    return []
  }
}

/**
 * Fork check: after the candidate move is played, does the moved piece attack
 * two or more enemy pieces worth at least a minor piece (or the king)?
 */
export function findForkTargets(fen: string, uci: string): string[] | null {
  let board: Chess
  try {
    board = new Chess(fen)
    board.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci[4] : undefined })
  } catch {
    return null
  }
  const after = board.fen()
  const to = uci.slice(2, 4)
  const mover = board.turn() === 'w' ? 'b' : 'w' // side that just moved
  const enemy: 'w' | 'b' = mover === 'w' ? 'b' : 'w'
  const moves = movesForTurn(after, mover)
  const targets: string[] = []
  for (const row of board.board()) {
    for (const cell of row) {
      if (!cell || cell.color !== enemy) continue
      if (PIECE_VALUES[cell.type] < 3) continue
      const attacked = moves.some((m) => m.from === to && m.to === cell.square)
      if (attacked) targets.push(cell.square)
    }
  }
  return targets.length >= 2 ? targets : null
}

/**
 * The square of the mover's piece that is hanging after their move (the
 * "lost piece" for blunder/mistake explanations), or null.
 */
export function findLostPiece(afterFen: string, toSquare: string, mover: 'w' | 'b'): string | null {
  const board = new Chess(afterFen)
  const enemy: 'w' | 'b' = mover === 'w' ? 'b' : 'w'
  const enemyMoves = movesForTurn(afterFen, enemy)
  const defenders = movesForTurn(
    (() => {
      const c = new Chess(afterFen)
      try {
        c.remove(toSquare as never)
      } catch {
        return afterFen
      }
      return c.fen()
    })(),
    mover,
  )
  const attacked = enemyMoves.some((m) => m.to === toSquare)
  const piece = board.get(toSquare as never)
  if (piece && piece.color === mover && attacked && defenders.length === 0 && PIECE_VALUES[piece.type] >= 3) {
    return toSquare
  }
  return null
}

/** The engine line that ends in mate, if any. */
export function findMatingLine(lines: EngineLine[]): EngineLine | null {
  return lines.find((l) => l.pvSan.some((s) => s.includes('#'))) ?? null
}
