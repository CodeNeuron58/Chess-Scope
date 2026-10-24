import { describe, expect, it } from 'vitest'
import { Chess, type Move } from 'chess.js'
import { classifyGame } from '../classify'
import type { PlyReview } from '../../types'

interface RawGame {
  sans: string[]
  /** white-persp cp for each position (index = plies played) */
  cps: number[]
  /** engine best move (lan) for each position, index = plies played before the move */
  best?: string[]
}

/** Build classifyGame inputs from a SAN sequence plus synthetic evals. */
function makeGame(raw: RawGame): { moves: Move[]; positions: PlyReview[] } {
  const board = new Chess()
  const fens: string[] = [board.fen()]
  const moves: import("chess.js").Move[] = []
  for (const san of raw.sans) {
    moves.push(board.move(san))
    fens.push(board.fen())
  }
  const positions = raw.cps.map((cp, i) => ({
    index: i,
    fen: fens[i],
    whiteCp: cp,
    lines: [],
    bestUci: raw.best?.[i] ?? '',
  }))
  return { moves, positions }
}

// out-of-book flank moves so book detection never overrides the tested class
const FLANK = {
  sans: ['a4', 'h5', 'g4'],
  best: ['a2a4', 'h7h5', 'g2g4'],
}

describe('classifyGame', () => {
  it('marks a move that matches the engine best as "best"', () => {
    const { moves, positions } = makeGame({
      sans: FLANK.sans,
      cps: [0, 0, 0, 0],
      best: FLANK.best,
    })
    const reviews = classifyGame(moves, positions)
    expect(reviews.map((r) => r.classification)).toEqual(['best', 'best', 'best'])
  })

  it('marks big win% drops as "blunder"', () => {
    // 1. f3?? — after f3 the position is much worse for White
    const { moves, positions } = makeGame({
      sans: ['f3', 'e5'],
      cps: [0, -600, -550],
      best: ['e2e4', ''],
    })
    const reviews = classifyGame(moves, positions)
    expect(reviews[0].classification).toBe('blunder')
  })

  it('marks a small win% drop as "excellent"', () => {
    const { moves, positions } = makeGame({
      sans: ['a4', 'a5', 'g3'],
      cps: [0, -5, -6, -6],
      best: ['', '', ''],
    })
    const reviews = classifyGame(moves, positions)
    expect(reviews[0].classification).toBe('excellent')
  })

  it('marks an enormous second-best gap on the engine move as "great"', () => {
    const { moves, positions } = makeGame({
      sans: FLANK.sans,
      cps: [0, 0, 900, 900],
      best: FLANK.best,
    })
    // fabricate a second line much worse than the best on the pre-move position
    positions[2].lines = [
      { uciFirst: 'g2g4', pvUci: ['g2g4'], pvSan: ['g4'], whiteCp: 900 },
      { uciFirst: 'a2a3', pvUci: ['a2a3'], pvSan: ['a3'], whiteCp: -600 },
    ]
    const reviews = classifyGame(moves, positions)
    expect(reviews[2].classification).toBe('great')
  })

  it('marks opening book moves as "book"', () => {
    const { moves, positions } = makeGame({
      sans: ['e4', 'c5', 'Nf3', 'd6'],
      cps: [30, 30, 30, 30, 30],
      best: ['e2e4', 'c7c5', 'g1f3', 'd7d6'],
    })
    const reviews = classifyGame(moves, positions)
    expect(reviews.map((r) => r.classification)).toEqual(['book', 'book', 'book', 'book'])
  })

  it('records per-move accuracy and win% for the report', () => {
    const { moves, positions } = makeGame({
      sans: ['e4', 'e5'],
      cps: [0, 20, 20],
      best: ['e2e4', ''],
    })
    const reviews = classifyGame(moves, positions)
    expect(reviews[0].accuracy).toBeGreaterThan(90)
    expect(reviews[0].winBefore).toBeCloseTo(50, 5)
    expect(reviews[0].winAfter).toBeGreaterThan(50)
  })
})
