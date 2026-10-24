import type { Classification, MoveReview } from '../types'

/**
 * Win probability model (percent for the side the eval belongs to).
 * Constants are the publicly documented chess.com accuracy model.
 */
export function winPercent(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1)
}

/**
 * Empirical calibration factor, fitted 2026-10 against chess.com's own official
 * game accuracies (3 games, 6 player-sides, Stockfish 19 Full @ depth 14):
 * the legacy public formula under-penalizes errors by ~3x on the current
 * chess.com model. k = 3.04 gave RMSE ≈ 5 vs their published numbers.
 * Revisit when more calibration data is available.
 */
const LOSS_SCALE = 3.04

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
 * Game Rating: Elo-style performance score from accuracy.
 * Linear fit on chess.com's own Game Review anchors
 * (acc 85.33 → ~1450, 77.71 → ~1200). A log-curve variant was tested and
 * reverted by user preference — see RESEARCH.md metric-design section.
 */
export function gameRating(accuracy: number): number {
  return Math.round(Math.min(2900, Math.max(600, 32.9 * accuracy - 1356)))
}

/** Average centipawn loss — the standard absolute quality metric (lichess-style). */
export function meanCpLoss(losses: number[]): number {
  if (losses.length === 0) return 0
  return losses.reduce((s, x) => s + x, 0) / losses.length
}
