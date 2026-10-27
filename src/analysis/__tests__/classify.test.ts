import { describe, expect, it } from 'vitest'
import { Chess, type Move } from 'chess.js'
import { classifyGame } from '../classify'
import type { EngineLine, PlyReview } from '../../types'

interface RawGame {
  fen?: string
  sans: string[]
  /** White-perspective cp for each position (index = plies played). */
  cps: number[]
  /** Engine lines for each position, index = plies played before the move. */
  lines?: Record<number, { uci: string; cp: number; pv?: string[] }[]>
}

/** Build classifyGame inputs from a SAN sequence plus synthetic engine output. */
function makeGame(raw: RawGame): { moves: Move[]; positions: PlyReview[] } {
  const board = new Chess(raw.fen)
  const fens: string[] = [board.fen()]
  const moves: Move[] = []
  for (const san of raw.sans) {
    moves.push(board.move(san))
    fens.push(board.fen())
  }
  const positions = raw.cps.map((cp, i) => {
    const lines: EngineLine[] = (raw.lines?.[i] ?? []).map((l) => ({
      uciFirst: l.uci,
      pvUci: l.pv ?? [l.uci],
      pvSan: [],
      whiteCp: l.cp,
    }))
    return { index: i, fen: fens[i], whiteCp: lines[0]?.whiteCp ?? cp, lines, bestUci: lines[0]?.uciFirst ?? '' }
  })
  return { moves, positions }
}

// king + pawn endgames are never book, and every move has alternatives
const KP_WHITE = '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1'
const KP_BLACK = '4k3/8/8/8/8/8/4P3/4K3 b - - 0 1'

describe('classifyGame — expected-points bands (chess.com)', () => {
  it('marks the engine move as "best"', () => {
    const g = makeGame({ fen: KP_WHITE, sans: ['e4'], cps: [100, 100], lines: { 0: [{ uci: 'e2e4', cp: 100 }] } })
    expect(classifyGame(g.moves, g.positions)[0].classification).toBe('best')
  })

  // equal position (0.50 expected points); the played move is not an engine line,
  // so its loss comes from the evaluation after it
  const cases: [number, string][] = [
    [-11, 'excellent'], // loses ~0.01
    [-38, 'good'], // ~0.035
    [-77, 'inaccuracy'], // ~0.07
    [-168, 'mistake'], // ~0.15
    [-376, 'blunder'], // ~0.30
  ]
  for (const [cpAfter, expected] of cases) {
    it(`a move to ${cpAfter}cp from equality is "${expected}"`, () => {
      const g = makeGame({ fen: KP_WHITE, sans: ['Kd1'], cps: [0, cpAfter], lines: { 0: [{ uci: 'e2e4', cp: 0 }] } })
      expect(classifyGame(g.moves, g.positions)[0].classification).toBe(expected)
    })
  }

  it('reports the expected points lost on each move', () => {
    const g = makeGame({ fen: KP_WHITE, sans: ['Kd1'], cps: [0, -168], lines: { 0: [{ uci: 'e2e4', cp: 0 }] } })
    expect(classifyGame(g.moves, g.positions)[0].pointsLost).toBeCloseTo(0.15, 2)
  })

  it('weighs the same eval drop more heavily for stronger players', () => {
    const g = makeGame({ fen: KP_WHITE, sans: ['Kd1'], cps: [0, -64], lines: { 0: [{ uci: 'e2e4', cp: 0 }] } })
    const strong = classifyGame(g.moves, g.positions, { whiteElo: 2600 })[0]
    const weak = classifyGame(g.moves, g.positions, { whiteElo: 700 })[0]
    expect(strong.pointsLost ?? 0).toBeGreaterThan(weak.pointsLost ?? 0)
    expect(strong.classification).toBe('inaccuracy')
    expect(weak.classification).toBe('good')
  })
})

describe('classifyGame — special classes', () => {
  it('calls the only good move "great"', () => {
    const g = makeGame({
      fen: KP_WHITE,
      sans: ['e4'],
      cps: [300, 300],
      lines: { 0: [{ uci: 'e2e4', cp: 300 }, { uci: 'e1d1', cp: -100 }] },
    })
    expect(classifyGame(g.moves, g.positions)[0].classification).toBe('great')
  })

  it('does not call a plain recapture "great"', () => {
    const g = makeGame({
      fen: '4k3/8/8/3r4/8/3R4/4K3/8 b - - 0 1',
      sans: ['Rxd3', 'Kxd3'],
      cps: [0, -500, 0],
      lines: { 1: [{ uci: 'e2d3', cp: 0 }, { uci: 'e2e1', cp: -500 }] },
    })
    expect(classifyGame(g.moves, g.positions)[1].classification).toBe('best')
  })

  it('calls failing to punish the opponent’s blunder a "miss"', () => {
    const g = makeGame({
      fen: KP_BLACK,
      sans: ['Kd7', 'Kd1'],
      cps: [0, 500, 0],
      lines: { 0: [{ uci: 'e8d8', cp: 0 }], 1: [{ uci: 'e2e4', cp: 500 }] },
    })
    const r = classifyGame(g.moves, g.positions)
    expect(r[0].classification).toBe('blunder')
    expect(r[1].classification).toBe('miss')
  })

  it('calls a sound piece sacrifice "brilliant" (Greek gift)', () => {
    const g = makeGame({
      fen: 'rnbq1rk1/ppp1bppp/4p3/3pP3/3P4/3B1N2/PPP2PPP/RNBQ1RK1 w - - 0 8',
      sans: ['Bxh7+'],
      cps: [150, 150],
      lines: { 0: [{ uci: 'd3h7', cp: 150 }], 1: [{ uci: 'g8h7', cp: 150, pv: ['g8h7', 'f3g5', 'h7g8'] }] },
    })
    expect(classifyGame(g.moves, g.positions)[0].classification).toBe('brilliant')
  })

  it('calls a queen sacrifice that forces mate "brilliant" even when already winning (Opera Game 16.Qb8+)', () => {
    const opera = new Chess()
    for (const san of 'e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7'.split(' ')) opera.move(san)
    const g = makeGame({
      fen: opera.fen(),
      sans: ['Qb8+'],
      cps: [19800, 19900],
      lines: { 0: [{ uci: 'b3b8', cp: 19800 }], 1: [{ uci: 'd7b8', cp: 19900, pv: ['d7b8', 'd1d8'] }] },
    })
    g.positions[1].mateIn = 1
    expect(classifyGame(g.moves, g.positions)[0].classification).toBe('brilliant')
  })

  it('does not call a trade that wins the material straight back "brilliant"', () => {
    // Bxh7+ Kxh7 Qh5+ Kg8 … but here the engine line recaptures at once
    const g = makeGame({
      fen: 'rnbq1rk1/ppp1bppp/4p3/3pP3/3P4/3B1N2/PPP2PPP/RNBQ1RK1 w - - 0 8',
      sans: ['Bxh7+'],
      cps: [150, 150],
      lines: { 0: [{ uci: 'd3h7', cp: 150 }], 1: [{ uci: 'g8h8', cp: 150, pv: ['g8h8', 'h7d3'] }] },
    })
    expect(classifyGame(g.moves, g.positions)[0].classification).toBe('best')
  })

  it('marks moves on named opening lines as "book" (transpositions included)', () => {
    const g = makeGame({ sans: ['e4', 'c5', 'Nf3', 'd6'], cps: [30, 30, 30, 30, 30] })
    expect(classifyGame(g.moves, g.positions).map((r) => r.classification)).toEqual(['book', 'book', 'book', 'book'])
  })

  it('marks the only legal move "forced"', () => {
    // the king is boxed in, so the pawn push is the only legal move
    const g = makeGame({ fen: '7k/8/p5Q1/8/8/8/8/K7 b - - 0 1', sans: ['a5'], cps: [0, 0] })
    expect(classifyGame(g.moves, g.positions)[0].classification).toBe('forced')
  })

  it('keeps the calibrated per-move accuracy and win% fields', () => {
    const g = makeGame({ fen: KP_WHITE, sans: ['e4'], cps: [0, 20], lines: { 0: [{ uci: 'e2e4', cp: 20 }] } })
    const r = classifyGame(g.moves, g.positions)[0]
    expect(r.accuracy).toBeGreaterThan(90)
    expect(r.winAfter).toBeGreaterThan(50)
  })
})
