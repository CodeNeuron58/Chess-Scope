import { Chess, type Move } from 'chess.js'
import type { Classification, MoveReview, PlyReview, ReviewContext } from '../types'
import { cpFor, expectedPoints, moveAccuracy, winFor } from './accuracy'
import { isBookPosition } from './openings'

const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3.25,
  r: 5,
  q: 9,
  k: 0,
}

function materialFor(color: 'w' | 'b', fen: string): number {
  const board = fen.split(' ')[0]
  let total = 0
  for (const ch of board) {
    if (ch === '/') continue
    const lower = ch.toLowerCase()
    if (PIECE_VALUES[lower] === undefined) continue
    if (color === 'w' && ch === lower) continue
    if (color === 'b' && ch === ch.toUpperCase()) continue
    total += PIECE_VALUES[lower]
  }
  return total
}

/** Total material value of both armies (kings excluded). */
export function totalMaterial(fen: string): number {
  return materialFor('w', fen) + materialFor('b', fen)
}

/** Mover's material minus the opponent's. */
function balance(fen: string, color: 'w' | 'b'): number {
  return materialFor(color, fen) - materialFor(color === 'w' ? 'b' : 'w', fen)
}

/**
 * chess.com's expected-points bands ("How are moves classified?"): the share of
 * a point a move gives away versus the best move. Best 0, Excellent ≤ .02,
 * Good ≤ .05, Inaccuracy ≤ .10, Mistake ≤ .20, Blunder above.
 */
export const EP_BANDS = { best: 0.002, excellent: 0.02, good: 0.05, inaccuracy: 0.1, mistake: 0.2 } as const

/** Second-best line must be this much worse for the engine move to be "the only good move". */
const GREAT_GAP = 0.1
/** Opportunity (and failure) size for a Miss. */
const MISS_SWING = 0.1

/** Balances along a line: index 0 = before the move, then after each ply. */
function balancesAlong(fen: string, ucis: string[], color: 'w' | 'b'): number[] {
  const out = [balance(fen, color)]
  let board: Chess
  try {
    board = new Chess(fen)
  } catch {
    return out
  }
  for (const uci of ucis) {
    try {
      board.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci[4] : undefined })
    } catch {
      break
    }
    out.push(balance(board.fen(), color))
  }
  return out
}

/**
 * A real sacrifice: after the opponent's best reply the mover is at least a
 * minor piece down, and the engine's continuation does not win it straight
 * back (unlike a trade or a desperado).
 */
function isSacrifice(move: Move, before: PlyReview, after: PlyReview): boolean {
  const pv = after.lines[0]?.pvUci ?? []
  const bal = balancesAlong(before.fen, [move.lan, ...pv.slice(0, 3)], move.color)
  const start = bal[0]
  const afterReply = bal[2]
  const afterRecapture = bal[3]
  if (afterReply === undefined || afterReply > start - 2) return false
  return afterRecapture === undefined || afterRecapture <= start - 2
}

/** The position after the move is a forced mate for the mover. */
function matesFor(after: PlyReview, mover: 'w' | 'b'): boolean {
  const mate = after.mateIn ?? after.lines[0]?.mateIn
  return mate !== undefined && (mover === 'w' ? mate > 0 : mate < 0)
}

interface MoveContext {
  move: Move
  prev?: Move
  before: PlyReview
  after: PlyReview
  /** Position before the opponent's previous move (for Miss). */
  beforePrev?: PlyReview
  replyFen?: string
  book: boolean
  elo?: number
}

function classifyOne(c: MoveContext): Omit<MoveReview, 'ply' | 'move' | 'isBook' | 'speech'> {
  const { move, prev, before, after, beforePrev, elo } = c
  const mover = move.color
  // accuracy keeps the calibrated (rating-free) win% model
  const winBefore = winFor(before.whiteCp, mover)
  const winAfter = winFor(after.whiteCp, mover)
  const accuracy = moveAccuracy(winBefore, winAfter)
  // Material is measured after the opponent's reply so that real sacrifices
  // (piece given up, recaptured) register as negative. The immediate delta is
  // only used for the final move of a game, where no reply exists.
  const materialBefore = materialFor(mover, before.fen)
  const materialDelta = c.replyFen ? materialFor(mover, c.replyFen) - materialBefore : materialFor(mover, after.fen) - materialBefore

  // classification uses chess.com-style expected points for the mover's rating
  const ep = (whiteCp: number) => expectedPoints(cpFor(whiteCp, mover), elo)
  const best = before.lines[0]
  const bestEP = ep(best?.whiteCp ?? before.whiteCp)
  const lineIdx = before.lines.findIndex((l) => l.uciFirst === move.lan)
  // a move the engine also searched is judged on that same search; others on the position after
  const playedEP = lineIdx >= 0 ? ep(before.lines[lineIdx].whiteCp) : ep(after.whiteCp)
  const loss = Math.max(0, bestEP - playedEP)
  const resultEP = ep(after.whiteCp)
  const second = before.lines[1]
  const secondCpWhite = second?.whiteCp

  const isTop = (before.bestUci !== '' && move.lan === normalizeUci(before.bestUci)) || lineIdx === 0
  const isBest = isTop || loss <= EP_BANDS.best
  const legalCount = new Chess(before.fen).moves().length

  // the opponent's last move handed the mover an opportunity of this size
  const prevGift = beforePrev ? bestEP - ep(beforePrev.whiteCp) : 0
  const prevWasError = prevGift >= MISS_SWING

  let classification: Classification
  if (legalCount === 1) {
    classification = 'forced'
  } else if (c.book) {
    classification = 'book'
  } else if (
    isBest &&
    loss <= EP_BANDS.excellent &&
    // in an already-won position a sacrifice is only brilliant if it forces mate (Morphy's 16.Qb8+)
    (bestEP < 0.95 || matesFor(after, mover)) &&
    resultEP >= 0.5 &&
    isSacrifice(move, before, after)
  ) {
    classification = 'brilliant'
  } else if (
    isTop &&
    second !== undefined &&
    bestEP - ep(second.whiteCp) >= GREAT_GAP &&
    resultEP >= 0.4 &&
    bestEP < 0.97 &&
    legalCount > 2 &&
    // a plain recapture, or grabbing what the opponent just hung, is "best", not "great"
    !(prev?.captured && prev.to === move.to) &&
    !(move.captured && prevWasError)
  ) {
    classification = 'great'
  } else if (isBest) {
    classification = 'best'
  } else if (prevWasError && loss >= MISS_SWING && beforePrev && playedEP >= ep(beforePrev.whiteCp) - MISS_SWING) {
    // gave back what the opponent's error offered without making things worse than before it
    classification = 'miss'
  } else if (loss <= EP_BANDS.excellent) {
    classification = 'excellent'
  } else if (loss <= EP_BANDS.good) {
    classification = 'good'
  } else if (loss <= EP_BANDS.inaccuracy) {
    classification = 'inaccuracy'
  } else if (loss <= EP_BANDS.mistake) {
    classification = 'mistake'
  } else {
    classification = 'blunder'
  }

  return {
    classification,
    accuracy,
    winBefore,
    winAfter,
    materialDelta,
    secondBestWhiteCp: secondCpWhite,
    pointsLost: loss,
  }
}

/** Strip stray suffix characters; engine bestmove and chess.js lan share format otherwise. */
function normalizeUci(uci: string): string {
  return uci.toLowerCase().replace(/[^a-h1-8qrbn]/g, '')
}

export function classifyGame(moves: Move[], positions: PlyReview[], ctx: ReviewContext = {}): MoveReview[] {
  const reviews: MoveReview[] = []
  // book while every position so far is on a named opening line
  let bookStreak = true
  for (let i = 0; i < moves.length; i++) {
    const move = moves[i]
    const before = positions[i]
    const after = positions[i + 1]
    if (!before || !after) break
    bookStreak = bookStreak && isBookPosition(after.fen)
    const r = classifyOne({
      move,
      prev: moves[i - 1],
      before,
      after,
      beforePrev: positions[i - 1],
      replyFen: positions[i + 2]?.fen,
      book: bookStreak,
      elo: move.color === 'w' ? ctx.whiteElo : ctx.blackElo,
    })
    reviews.push({
      ply: i + 1,
      move,
      ...r,
      isBook: r.classification === 'book',
      speech: '',
    })
  }
  return reviews
}
