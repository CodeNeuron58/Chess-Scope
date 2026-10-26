import type { Classification, MoveReview, Speed } from '../types'

/**
 * Win probability model (percent for the side the eval belongs to).
 * Constants are the publicly documented chess.com accuracy model.
 */
export function winPercent(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1)
}

/**
 * How much a centipawn edge is worth at a given strength. chess.com classifies
 * moves with an "expected points" model that depends on the players' rating:
 * stronger players convert advantages more reliably, so the same eval is worth
 * more. The lichess curve above (0.00368208) was fit on strong players; this
 * scales its slope from 0.6x at 800 to 1.0x at 2300 (1.1x cap). Unknown rating
 * keeps the plain curve. Approximation — chess.com does not publish theirs.
 */
export function ratingSlope(elo?: number): number {
  if (!elo || !Number.isFinite(elo)) return 1
  return Math.min(1.1, Math.max(0.6, 0.6 + (0.4 * (elo - 800)) / 1500))
}

/** Expected points (0-1) for the side the eval belongs to, rating-aware. */
export function expectedPoints(cp: number, elo?: number): number {
  return 1 / (1 + Math.exp(-0.00368208 * ratingSlope(elo) * cp))
}

/**
 * Empirical calibration factor: the legacy public formula under-penalizes
 * errors versus chess.com's official game accuracies. Refit 2026-10-27 on 32
 * games / 64 player-sides (20 blitz, 12 bullet; Stockfish 19 Full, depth 14,
 * MultiPV 2): k = 2.64 gives RMSE 5.56 with no bias, leave-one-game-out 5.66
 * (the earlier 6-side fit, k = 3.04, reads 2.2 points low here: RMSE 5.90).
 * Blitz alone prefers ~2.5 and bullet ~2.9 — not enough bullet data to split.
 */
const LOSS_SCALE = 2.64

/** Per-move accuracy from the mover's win% before and after their move. */
export function moveAccuracy(winBefore: number, winAfter: number): number {
  const drop = Math.max(0, winBefore - winAfter) * LOSS_SCALE
  const acc = 103.1668 * Math.exp(-0.04354 * drop) - 3.1669
  return Math.min(100, Math.max(0, acc))
}

export function formatEval(whiteCp: number, mateIn?: number): string {
  if (mateIn !== undefined && Math.abs(whiteCp) > 10000) {
    const n = Math.abs(mateIn)
    return mateIn > 0 ? `M${n}` : `-M${n}`
  }
  const v = whiteCp / 100
  return (v > 0 ? '+' : '') + v.toFixed(1)
}

/** Mover-perspective eval in centipawns. */
export function cpFor(whiteCp: number, color: 'w' | 'b'): number {
  return color === 'w' ? whiteCp : -whiteCp
}

export function winFor(whiteCp: number, color: 'w' | 'b'): number {
  return winPercent(cpFor(whiteCp, color))
}

export interface AccuracySummary {
  white: number
  black: number
}

export function summarizeAccuracy(moves: MoveReview[]): AccuracySummary {
  const whiteMoves = moves.filter((m) => m.move.color === 'w')
  const blackMoves = moves.filter((m) => m.move.color === 'b')
  const mean = (list: MoveReview[]) =>
    list.length === 0 ? 100 : list.reduce((s, m) => s + m.accuracy, 0) / list.length
  return { white: mean(whiteMoves), black: mean(blackMoves) }
}

export const CLASSIFICATION_ORDER: Classification[] = [
  'brilliant',
  'great',
  'best',
  'excellent',
  'good',
  'book',
  'forced',
  'inaccuracy',
  'mistake',
  'miss',
  'blunder',
]

/**
 * Typical accuracy for a rating and time control. Faster games are less accurate
 * at every level; ~0.6 accuracy points per 100 Elo. Provisional constants,
 * anchored on a 2026-rated bullet game chess.com scored 71.7 / 70.8 → 1900 / 1900
 * (see RESEARCH.md) — refit as more chess.com Game Ratings are collected.
 */
const EXPECTED_ACC_AT_1500: Record<Speed, number> = { bullet: 70.6, blitz: 73, rapid: 75.5, classical: 77.5, daily: 78.5 }
const ACC_PER_100_ELO = 0.6
/** Elo gained per accuracy point above what is typical for the player. */
const ELO_PER_ACC_POINT = 50

export function expectedAccuracy(elo: number, speed: Speed = 'blitz'): number {
  return EXPECTED_ACC_AT_1500[speed] + (ACC_PER_100_ELO * (elo - 1500)) / 100
}

/**
 * Game Rating: an Elo-style estimate of how well someone played this game.
 *
 * chess.com's Game Rating is anchored on the players' ratings, not accuracy
 * alone: ~71% accuracy reads 1900 between 2025-rated bullet players, while
 * ~59.5% reads ~575 between beginners. With a known rating we start from it and
 * move ±50 Elo per accuracy point versus what is typical for that rating and
 * time control, rounded to 50 like chess.com. Without a rating (plain PGN), it
 * falls back to the accuracy-only fit (acc 85.33 → ~1450, 77.71 → ~1200).
 */
export function gameRating(accuracy: number, ctx: { elo?: number; speed?: Speed } = {}): number {
  if (ctx.elo && Number.isFinite(ctx.elo) && ctx.elo > 0) {
    const raw = ctx.elo + ELO_PER_ACC_POINT * (accuracy - expectedAccuracy(ctx.elo, ctx.speed))
    return Math.min(3000, Math.max(100, Math.round(raw / 50) * 50))
  }
  return Math.round(Math.min(2900, Math.max(600, 32.9 * accuracy - 1356)))
}

/** Average centipawn loss — the standard absolute quality metric (lichess-style). */
export function meanCpLoss(losses: number[]): number {
  if (losses.length === 0) return 0
  return losses.reduce((s, x) => s + x, 0) / losses.length
}
