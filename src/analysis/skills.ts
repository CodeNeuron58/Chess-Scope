import { Chess, type Move } from 'chess.js'
import type { PlayerSkills, PlyReview, SkillMeter } from '../types'

interface Stats {
  captures: number
  checks: number
  castles: number
  checkmates: number
  freeTaken: number
  defended: number
  retreats: number
}

function emptyStats(): Stats {
  return { captures: 0, checks: 0, castles: 0, checkmates: 0, freeTaken: 0, defended: 0, retreats: 0 }
}

const rankOf = (square: string) => Number(square[1])

/** Number of legal moves for `color` that land on `square` (turn field is swapped in the FEN). */
function movesLandingOn(fen: string, square: string, color: 'w' | 'b'): number {
  const parts = fen.split(' ')
  if (parts.length < 2) return 0
  parts[1] = color
  let board: Chess
  try {
    board = new Chess(parts.join(' '))
  } catch {
    return 0
  }
  return board.moves({ verbose: true }).filter((m) => m.to === square).length
}

/** True when the piece on `square` (owned by the opponent of `hunter`) is attacked by the hunter and undefended. */
function isFreePiece(fen: string, square: string, hunter: 'w' | 'b'): boolean {
  let board: Chess
  try {
    board = new Chess(fen)
  } catch {
    return false
  }
  const piece = board.get(square as never)
  if (!piece || piece.color === hunter) return false
  if (piece.type === 'k') return false
  if (movesLandingOn(fen, square, hunter) === 0) return false
  let stripped: Chess
  try {
    stripped = new Chess(fen)
    stripped.remove(square as never)
  } catch {
    return false
  }
  return movesLandingOn(stripped.fen(), square, piece.color) === 0
}

function hangingOwnSquares(fen: string, color: 'w' | 'b'): string[] {
  const board = new Chess(fen)
  const out: string[] = []
  for (const row of board.board()) {
    for (const cell of row) {
      if (!cell || cell.color !== color || cell.type === 'k') continue
      if (isFreePiece(fen, cell.square, color === 'w' ? 'b' : 'w')) out.push(cell.square)
    }
  }
  return out
}

const TARGETS: Record<string, number> = {
  captures: 5,
  checks: 5,
  castles: 3,
  checkmates: 3,
  freeTaken: 10,
  defended: 10,
  retreats: 10,
}

const LABELS: Record<string, string> = {
  captures: 'Captures',
  checks: 'Checks',
  castles: 'Castles',
  checkmates: 'Checkmates',
  freeTaken: 'Free Pieces',
  defended: 'Defends Pieces',
  retreats: 'Retreats',
}

export function computeSkills(moves: Move[], positions: PlyReview[]): { white: PlayerSkills; black: PlayerSkills } {
  const stats: Record<'w' | 'b', Stats> = { w: emptyStats(), b: emptyStats() }
  for (let i = 0; i < moves.length; i++) {
    const move = moves[i]
    const before = positions[i]
    const after = positions[i + 1]
    if (!before || !after) break
    const s = stats[move.color]
    if (move.flags.includes('c') || move.flags.includes('e')) {
      s.captures++
      if (isFreePiece(before.fen, move.to, move.color)) s.freeTaken++
    }
    if (move.san.includes('+')) s.checks++
    if (move.flags.includes('k') || move.flags.includes('q')) s.castles++
    if (move.san.includes('#')) s.checkmates++
    const rankDelta = rankOf(move.to) - rankOf(move.from)
    if (move.color === 'w' ? rankDelta < 0 : rankDelta > 0) s.retreats++

    // Defense: had a hanging piece before the move, and that square no longer holds
    // a hanging own piece afterwards (moved away, defended it, or captured the attacker).
    const hangingBefore = hangingOwnSquares(before.fen, move.color)
    if (hangingBefore.length > 0) {
      const hangingAfter = new Set(hangingOwnSquares(after.fen, move.color))
      if (hangingBefore.some((sq) => !hangingAfter.has(sq))) s.defended++
    }
  }

  const build = (color: 'w' | 'b'): PlayerSkills => {
    const s = stats[color]
    const meters: SkillMeter[] = Object.keys(TARGETS).map((key) => ({
      key,
      label: LABELS[key],
      taken: s[key as keyof Stats],
      target: TARGETS[key],
    }))
    return { meters }
  }
  return { white: build('w'), black: build('b') }
}
