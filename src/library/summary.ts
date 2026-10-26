import type { MoveReview, PlyReview, ReviewResult } from '../types'
import type { EngineChoice } from '../engine/engineClient'
import { MISTAKE_CLASSES } from '../lib/constants'
import { totalMaterial } from '../analysis/classify'
import { findForkTargets, findLostPiece } from '../analysis/patterns'
import type { DrillItem, DrillTheme, MoveStat, ReviewSummary } from './types'
import { parseClocks, parseTimeControl } from './pgnMeta'

/** Same thresholds as the Advanced Stats buckets in analysis/review.ts. */
const ENDGAME_MATERIAL = 24
const OPENING_PLIES = 16

export function phaseOf(ply: number, fenBefore: string): MoveStat['phase'] {
  if (totalMaterial(fenBefore) <= ENDGAME_MATERIAL) return 'endgame'
  return ply <= OPENING_PLIES ? 'opening' : 'middlegame'
}

/** Why the mistake mattered, for drill grouping and hints. */
export function themeOf(mr: MoveReview, before: PlyReview, after: PlyReview): { theme: DrillTheme; mateIn?: number } {
  const color = mr.move.color
  const best = before.lines[0]
  if (best?.mateIn !== undefined && (color === 'w' ? best.mateIn > 0 : best.mateIn < 0)) {
    return { theme: 'mate', mateIn: Math.abs(best.mateIn) }
  }
  if (findLostPiece(after.fen, mr.move.to, color)) return { theme: 'hanging' }
  if (before.bestUci && findForkTargets(before.fen, before.bestUci)) return { theme: 'fork' }
  const bestSan = best?.pvSan[0] ?? ''
  if (bestSan.includes('x') || bestSan.includes('+')) return { theme: 'tactic' }
  if (mr.classification === 'miss') return { theme: 'win' }
  return { theme: 'positional' }
}

export const THEME_LABELS: Record<DrillTheme, string> = {
  mate: 'Missed mate',
  fork: 'Fork',
  hanging: 'Hanging piece',
  tactic: 'Missed tactic',
  win: 'Missed win',
  positional: 'Better plan',
}

export function themeLabel(item: Pick<DrillItem, 'theme' | 'mateIn'>): string {
  if (item.theme === 'mate' && item.mateIn) return `Mate in ${item.mateIn}`
  return THEME_LABELS[item.theme]
}

/** Drill items for every mistake in a review (both sides). */
export function extractMistakes(result: ReviewResult, gameId: string, clocks: number[] = []): DrillItem[] {
  const items: DrillItem[] = []
  for (const mr of result.moves) {
    if (!MISTAKE_CLASSES.includes(mr.classification)) continue
    const before = result.positions[mr.ply - 1]
    const after = result.positions[mr.ply]
    if (!before || !after || before.lines.length === 0) continue
    const { theme, mateIn } = themeOf(mr, before, after)
    items.push({
      id: `${gameId}:${mr.ply}`,
      gameId,
      ply: mr.ply,
      color: mr.move.color,
      cls: mr.classification,
      fen: before.fen,
      played: { uci: mr.move.lan, san: mr.move.san, whiteCp: after.whiteCp, mateIn: after.mateIn },
      lines: before.lines.slice(0, 3).map((l) => ({
        uci: l.uciFirst,
        san: l.pvSan[0] ?? l.uciFirst,
        whiteCp: l.whiteCp,
        mateIn: l.mateIn,
        pvSan: l.pvSan.slice(0, 8),
      })),
      winLoss: Math.max(0, mr.winBefore - mr.winAfter),
      theme,
      mateIn,
      phase: phaseOf(mr.ply, before.fen),
      clock: mr.ply > 2 ? clocks[mr.ply - 3] : undefined,
    })
  }
  return items
}

export interface SummaryContext {
  gameId: string
  pgn: string
  timeControl?: string
  engine: EngineChoice
}

/** Compact, storable digest of a full review for Home, Library, Insights and Drills. */
export function buildSummary(result: ReviewResult, ctx: SummaryContext): ReviewSummary {
  const clocksRaw = parseClocks(ctx.pgn)
  const clocks = clocksRaw.length === result.moves.length ? clocksRaw : []
  const moves: MoveStat[] = result.moves.map((mr, i) => ({
    c: mr.move.color,
    acc: Math.round(mr.accuracy * 10) / 10,
    win: Math.round(mr.winBefore * 10) / 10,
    cls: mr.classification,
    clk: clocks[i],
    phase: phaseOf(mr.ply, result.positions[mr.ply - 1]?.fen ?? ''),
  }))
  return {
    reviewedAt: Date.now(),
    depth: result.depth,
    engine: ctx.engine,
    accuracy: { white: result.whiteAccuracy, black: result.blackAccuracy },
    rating: result.gameRating,
    acpl: result.acpl,
    counts: result.counts,
    phases: result.advanced,
    moves,
    mistakes: extractMistakes(result, ctx.gameId, clocks),
    clock: parseTimeControl(ctx.timeControl),
  }
}
