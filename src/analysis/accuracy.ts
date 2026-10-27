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
 * Typical chess.com accuracy by rating and time control: the mean of chess.com's
 * own accuracies over 9,032 player-sides of rated, reviewed games (public API,
 * random and titled players, Oct 2026), made non-decreasing in rating. Bands with
 * under 40 games were dropped; ratings between knots are interpolated, and
 * ratings beyond the ends use the end value. See RESEARCH.md.
 */
const TYPICAL_ACC: Record<'bullet' | 'blitz' | 'rapid', [rating: number, accuracy: number][]> = {
  bullet: [[300, 63], [500, 65], [700, 69], [900, 71], [1900, 74], [2100, 75], [2300, 75], [2500, 79], [2700, 79]],
  blitz: [[300, 62], [500, 65.5], [700, 69], [900, 70.5], [1100, 73.5], [1300, 74.5], [1500, 76], [1900, 79.5], [2100, 79.5], [2300, 80], [2500, 82.5], [2700, 82.5]],
  rapid: [[300, 60], [500, 65], [700, 67], [900, 71], [1100, 73], [2100, 83], [2300, 84], [2500, 86.5]],
}
/** Daily games read ~3.5 points above rapid (small sample); classical uses rapid. */
const DAILY_OVER_RAPID = 3.5
/**
 * Elo per accuracy point above or below typical. Fits chess.com's 1900 / 1900 for
 * a 2025 / 2027-rated bullet game at 71.7 / 70.8, and the ~33 Elo per point gap
 * between two players of one game (85.3 → 1450, 77.7 → 1200).
 */
const ELO_PER_ACC_POINT = 35

function interpolate(knots: [number, number][], x: number): number {
  if (x <= knots[0][0]) return knots[0][1]
  for (let i = 1; i < knots.length; i++) {
    const [x1, y1] = knots[i]
    if (x <= x1) {
      const [x0, y0] = knots[i - 1]
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
    }
  }
  return knots[knots.length - 1][1]
}

export function expectedAccuracy(elo: number, speed: Speed = 'blitz'): number {
  if (speed === 'bullet' || speed === 'blitz') return interpolate(TYPICAL_ACC[speed], elo)
  return interpolate(TYPICAL_ACC.rapid, elo) + (speed === 'daily' ? DAILY_OVER_RAPID : 0)
}

/**
 * Game Rating: an Elo-style estimate of how well someone played this game.
 *
 * chess.com: "comparing the quality of your moves to what is expected from a
 * player at your rating level", averaging out to the player's rating over time.
 * So with a known rating we start from it and move ±35 Elo per accuracy point
 * versus the typical accuracy at that rating and time control, rounded to 50
 * like chess.com. Measured against the typical accuracies above, the average
 * comes out within ~15 Elo of the players' ratings in every band. Without a
 * rating (plain PGN), it falls back to the accuracy-only fit (85.33 → ~1450,
 * 77.71 → ~1200).
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
