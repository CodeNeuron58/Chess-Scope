import { Chess, type Move } from 'chess.js'
import type { Classification, MoveReview, PlyReview } from '../types'
import { moveAccuracy, winFor, cpFor } from './accuracy'
import { OPENING_LINES } from './openings'

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

/** Total non-pawn-material value of both armies (kings excluded). */
export function totalMaterial(fen: string): number {
  return materialFor('w', fen) + materialFor('b', fen)
}

const STANDARD_START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w'

const bookPrefixes = new Set<string>()
for (const line of OPENING_LINES) {
  const parts = line.san.split(' ')
  let acc = ''
  for (const p of parts) {
    acc = acc ? `${acc} ${p}` : p
    bookPrefixes.add(acc)
  }
}

function isBookSoFar(sanSequence: string): boolean {
  return bookPrefixes.has(sanSequence)
}

function classifyOne(
  move: Move,
  before: PlyReview,
  after: PlyReview,
  replyFen: string | undefined,
  bookSoFar: boolean,
): { classification: Classification; accuracy: number; winBefore: number; winAfter: number; materialDelta: number; secondBestWhiteCp?: number } {
  const mover = move.color
  const winBefore = winFor(before.whiteCp, mover)
  const winAfter = winFor(after.whiteCp, mover)
  const accuracy = moveAccuracy(winBefore, winAfter)
  // Material is measured after the opponent's reply so that real sacrifices
  // (piece given up, recaptured) register as negative. The immediate delta is
  // only used for the final move of a game, where no reply exists.
  const materialBefore = materialFor(mover, before.fen)
  const materialDelta = replyFen
    ? materialFor(mover, replyFen) - materialBefore
    : materialFor(mover, after.fen) - materialBefore

  const legalCount = new Chess(before.fen).moves().length
  const playedUci = move.lan
  const isBest = before.bestUci !== '' && playedUci === normalizeUci(before.bestUci)
  const bestCpMover = cpFor(before.whiteCp, mover)
  const secondCpWhite = before.lines[1]?.whiteCp
  const secondCpMover = secondCpWhite !== undefined ? cpFor(secondCpWhite, mover) : undefined
  const gap = secondCpMover !== undefined ? bestCpMover - secondCpMover : 0

  let classification: Classification
  if (legalCount === 1) {
    classification = 'forced'
  } else if (bookSoFar) {
    classification = 'book'
  } else if (
    isBest &&
    materialDelta <= -1.75 &&
    winAfter >= 50 &&
    winBefore - winAfter <= 2.5
  ) {
    classification = 'brilliant'
  } else if (isBest && gap >= 140 && winAfter >= 35) {
    classification = 'great'
  } else if (isBest) {
    classification = 'best'
  } else if (winBefore >= 85 && winAfter < 65) {
    classification = 'miss'
  } else {
    const delta = winBefore - winAfter
    if (delta <= 0.5) classification = 'excellent'
    else if (delta <= 1.2) classification = 'good'
    else if (delta <= 2.2) classification = 'inaccuracy'
    else if (delta <= 5) classification = 'mistake'
    else classification = 'blunder'
  }

  return {
    classification,
    accuracy,
    winBefore,
    winAfter,
    materialDelta,
    secondBestWhiteCp: secondCpWhite,
  }
}

/** Strip stray suffix characters; engine bestmove and chess.js lan share format otherwise. */
function normalizeUci(uci: string): string {
  return uci.toLowerCase().replace(/[^a-h1-8qrbn]/g, '')
}

export function classifyGame(moves: Move[], positions: PlyReview[]): MoveReview[] {
  const reviews: MoveReview[] = []
  // the opening book only applies to games from the standard start position
  let bookStreak: boolean = !moves[0]?.before || moves[0].before.startsWith(STANDARD_START)
  for (let i = 0; i < moves.length; i++) {
    const move = moves[i]
    const before = positions[i]
    const after = positions[i + 1]
    if (!before || !after) break
    const sanSeq = moves
      .slice(0, i + 1)
      .map((m) => m.san)
      .join(' ')
    const bookSoFar: boolean = bookStreak && isBookSoFar(sanSeq)
    bookStreak = bookSoFar
    const r = classifyOne(move, before, after, positions[i + 2]?.fen, bookSoFar)
    reviews.push({
      ply: i + 1,
      move,
      classification: r.classification,
      accuracy: r.accuracy,
      winBefore: r.winBefore,
      winAfter: r.winAfter,
      isBook: r.classification === 'book',
      materialDelta: r.materialDelta,
      secondBestWhiteCp: r.secondBestWhiteCp,
      speech: '',
    })
  }
  return reviews
}
