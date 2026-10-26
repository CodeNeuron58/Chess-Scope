import { Chess } from 'chess.js'
import type { Classification, EngineLine, MoveReview, PhaseStats, PlyReview, ReviewResult } from '../../types'
import type { ReviewSummary, StoredGame } from '../types'

const PHASES: PhaseStats = { opening: 90, tactics: 80, strategy: 85, endgame: 0, counts: { opening: 4, tactics: 2, strategy: 2, endgame: 0 } }

/**
 * A hand-built review of 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6 4.d3:
 * 3…Nf6 is a blunder (allows Qxf7#) and 4.d3 is a miss (Qxf7# was mate in 1).
 */
export function scholarsReview(): ReviewResult {
  const c = new Chess()
  for (const san of ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'd3']) c.move(san)
  const moves = c.history({ verbose: true })
  const fens = [moves[0].before, ...moves.map((m) => m.after)]
  const line = (uci: string, san: string, whiteCp: number, mateIn?: number): EngineLine => ({ uciFirst: uci, pvUci: [uci], pvSan: [san], whiteCp, mateIn })
  const evals = [30, 30, 30, 30, 40, 40, 19900, 30]
  const positions: PlyReview[] = fens.map((fen, i) => ({ index: i, fen, whiteCp: evals[i], lines: [line('a2a3', 'a3', evals[i])], bestUci: 'a2a3' }))
  // before 3…Nf6: Black's best was 3…g6; before 4.d3: Qxf7# mates
  positions[5] = { ...positions[5], lines: [line('g7g6', 'g6', 40), line('d8e7', 'Qe7', 45)], bestUci: 'g7g6' }
  positions[6] = { ...positions[6], mateIn: 1, lines: [line('h5f7', 'Qxf7#', 19900, 1)], bestUci: 'h5f7' }
  const cls: Classification[] = ['book', 'book', 'book', 'book', 'best', 'blunder', 'miss']
  const mr: MoveReview[] = moves.map((move, i) => ({
    ply: i + 1,
    move,
    classification: cls[i],
    accuracy: cls[i] === 'blunder' || cls[i] === 'miss' ? 10 : 100,
    winBefore: cls[i] === 'miss' ? 100 : 48,
    winAfter: cls[i] === 'blunder' ? 0 : cls[i] === 'miss' ? 53 : 48,
    isBook: cls[i] === 'book',
    materialDelta: 0,
    speech: '',
  }))
  return {
    positions,
    moves: mr,
    whiteAccuracy: 85,
    blackAccuracy: 70,
    depth: 14,
    counts: { white: { book: 2, best: 1, miss: 1 }, black: { book: 2, blunder: 1 } },
    gameRating: { white: 1400, black: 950 },
    acpl: { white: 200, black: 500 },
    skills: { white: { meters: [] }, black: { meters: [] } },
    advanced: { white: PHASES, black: PHASES },
  }
}

export function storedGame(over: Partial<StoredGame> & { summary?: ReviewSummary }): StoredGame {
  return {
    id: 'pgn:test',
    source: 'upload',
    pgn: '1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. d3 *',
    white: 'Me',
    black: 'Them',
    result: '1-0',
    playedAt: Date.UTC(2026, 9, 20),
    addedAt: Date.UTC(2026, 9, 20),
    plies: 7,
    ...over,
  }
}
