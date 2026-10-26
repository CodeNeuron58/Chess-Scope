import { Chess } from 'chess.js'
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


/** "10… Qb4+ 11. Qxb4 cxb5" — a SAN line numbered from the position after `ply` half-moves. */
export function formatLine(pvSan: string[], ply: number, max = 8): string {
  const parts: string[] = []
  pvSan.slice(0, max).forEach((san, i) => {
    const p = ply + i
    const num = Math.floor(p / 2) + 1
    if (p % 2 === 0) parts.push(`${num}. ${san}`)
    else parts.push(i === 0 ? `${num}… ${san}` : san)
  })
  return parts.join(' ')
}

/** Display result for a game: the PGN Result header, else the board state. */
export function displayResult(headers: Record<string, string>, g: Chess): string {
  const h = headers.Result
  if (h && h !== '*') return h === '1/2-1/2' ? '½-½' : h
  const r = gameResult(g)
  return r === '*' ? '' : r === '1/2-1/2' ? '½-½' : r
}

/** Half-moves already played before a FEN's position (from its move counter and side to move). */
export function startPly(fen: string): number {
  const parts = fen.split(' ')
  const full = Number(parts[5] ?? 1)
  return (Number.isFinite(full) && full > 0 ? full - 1 : 0) * 2 + (parts[1] === 'b' ? 1 : 0)
}

const START_COUNT: Record<string, number> = { q: 1, r: 2, b: 2, n: 2, p: 8 }
const PIECE_POINTS: Record<string, number> = { q: 9, r: 5, b: 3, n: 3, p: 1 }

/** Pieces each side has captured, plus the material balance (White minus Black), from a FEN. */
export function captures(fen: string): { byWhite: string[]; byBlack: string[]; balance: number } {
  const count: Record<'w' | 'b', Record<string, number>> = { w: {}, b: {} }
  let balance = 0
  for (const ch of fen.split(' ')[0] ?? '') {
    const lower = ch.toLowerCase()
    if (!(lower in PIECE_POINTS)) continue
    const side = ch === lower ? 'b' : 'w'
    count[side][lower] = (count[side][lower] ?? 0) + 1
    balance += side === 'w' ? PIECE_POINTS[lower] : -PIECE_POINTS[lower]
  }
  const missing = (side: 'w' | 'b') =>
    (['q', 'r', 'b', 'n', 'p'] as const).flatMap((p) => Array(Math.max(0, START_COUNT[p] - (count[side][p] ?? 0))).fill(p) as string[])
  return { byWhite: missing('b'), byBlack: missing('w'), balance }
}

