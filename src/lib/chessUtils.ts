import { Chess, type Square } from 'chess.js'
import type { PlayerInfo } from '../types'

/** Swap the side to move in a FEN (for threat analysis). Null if malformed. */
export function flipTurn(fen: string): string | null {
  const parts = fen.split(' ')
  if (parts.length < 2) return null
  parts[1] = parts[1] === 'w' ? 'b' : 'w'
  return parts.join(' ')
}

export function gameResult(g: Chess): string {
  if (g.isCheckmate()) return g.turn() === 'w' ? '0-1' : '1-0'
  if (g.isDraw() || g.isStalemate() || g.isInsufficientMaterial() || g.isThreefoldRepetition())
    return '1/2-1/2'
  return '*'
}

export function headersOf(g: Chess): PlayerInfo {
  const h = g.getHeaders?.() ?? {}
  return {
    white: h.White && h.White !== '?' ? h.White : 'White',
    black: h.Black && h.Black !== '?' ? h.Black : 'Black',
  }
}

/** "e2e4" (optionally "e7e8q") → [fromSquare, toSquare]. */
export function uciToSquares(uci: string): [Square, Square] {
  return [uci.slice(0, 2) as Square, uci.slice(2, 4) as Square]
}
