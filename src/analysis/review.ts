import { Chess, type Move } from 'chess.js'
import type { Classification, MoveReview, PhaseStats, PlyReview, ReviewContext, ReviewResult } from '../types'
import { EngineClient, positionToReview, type PositionEval } from '../engine/engineClient'
import { classifyGame, totalMaterial } from './classify'
import { gameRating, meanCpLoss, summarizeAccuracy, cpFor } from './accuracy'
import { KEY_CLASSES } from '../lib/constants'
import { coachExplain, coachSpeech } from './coach'
import { computeSkills } from './skills'

const ENDGAME_MATERIAL = 24

/**
 * chess.com's premium "Advanced Stats" equivalent: per-move accuracies grouped
 * by position type. Endgame wins over the opening bucket; otherwise the first
 * 16 plies are opening; after that a position with captures available (or a
 * check played) counts as tactical, everything else as strategic.
 */
function computeAdvanced(moveReviews: MoveReview[], positions: PlyReview[]): { white: PhaseStats; black: PhaseStats } {
  type Buckets = { opening: number[]; tactics: number[]; strategy: number[]; endgame: number[] }
  const mkBuckets = (): Buckets => ({ opening: [], tactics: [], strategy: [], endgame: [] })
  const buckets = { white: mkBuckets(), black: mkBuckets() }
  for (const mr of moveReviews) {
    const before = positions[mr.ply - 1]
    if (!before) continue
    let bucket: keyof Buckets
    if (totalMaterial(before.fen) <= ENDGAME_MATERIAL) bucket = 'endgame'
    else if (mr.ply <= 16) bucket = 'opening'
    else {
      let hasCaptures = false
      try {
        hasCaptures = new Chess(before.fen).moves().some((m) => m.includes('x'))
      } catch {
        hasCaptures = false
      }
      bucket = hasCaptures || mr.move.san.includes('+') ? 'tactics' : 'strategy'
    }
    buckets[mr.move.color === 'w' ? 'white' : 'black'][bucket].push(mr.accuracy)
  }
  const mean = (xs: number[]) =>
    xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length
  const build = (b: Buckets): PhaseStats => ({
    opening: mean(b.opening),
    tactics: mean(b.tactics),
    strategy: mean(b.strategy),
    endgame: mean(b.endgame),
    counts: {
      opening: b.opening.length,
      tactics: b.tactics.length,
      strategy: b.strategy.length,
      endgame: b.endgame.length,
    },
  })
  return { white: build(buckets.white), black: build(buckets.black) }
}

export interface EvalCache {
  get: (key: string) => Promise<PositionEval | null>
  put: (key: string, value: PositionEval) => Promise<void>
}

/**
 * Lines per position for reviews. Two is what classification needs (the
 * second-best line decides "Great"); a third line costs ~30% more time.
 */
export const REVIEW_MULTIPV = 2

/** Per-position time cap by depth, so a few sharp positions cannot stall a review. */
export function movetimeFor(depth: number): number {
  if (depth <= 10) return 2500
  if (depth <= 14) return 6000
  if (depth <= 18) return 15000
  return 30000
}

export interface ReviewOptions {
  depth: number
  onProgress?: (done: number, total: number) => void
  signal: { cancelled: boolean }
  /** Lines per position (default REVIEW_MULTIPV). */
  multiPv?: number
  /** Engine-result cache; `cacheTag` separates engines in its keys. */
  cache?: EvalCache
  cacheTag?: string
  /** Player ratings and time control, for the rating-aware classification and Game Rating. */
  context?: ReviewContext
}

export interface ReplayResult {
  moves: Move[]
  fens: string[]
}

/** Replay a move list, returning every position's FEN (index i = after i plies). */
export function replay(moves: Move[]): ReplayResult {
  // games loaded from a FEN start there; chess.js records it on every move
  const board = new Chess(moves[0]?.before)
  const fens: string[] = [board.fen()]
  const clean: Move[] = []
  for (const m of moves) {
    const applied = board.move({ from: m.from, to: m.to, promotion: m.promotion })
    clean.push(applied)
    fens.push(board.fen())
  }
  return { moves: clean, fens }
}

/** Positions per work item: small enough to balance, long enough for hash reuse. */
const CHUNK = 3

/**
 * Analyse every position of a game. With several engines, positions are cut
 * into short contiguous chunks that each engine pulls as soon as it is free
 * (and as soon as it has loaded), so no engine waits on another and each
 * keeps its hash warm across neighbouring positions.
 */
export async function reviewGame(
  moves: Move[],
  engines: EngineClient | EngineClient[],
  opts: ReviewOptions,
): Promise<ReviewResult> {
  const pool = Array.isArray(engines) ? engines : [engines]
  const { fens } = replay(moves)
  const total = fens.length
  const multiPv = opts.multiPv ?? REVIEW_MULTIPV
  const ctx = opts.context ?? {}
  const results: PositionEval[] = new Array(total)
  let done = 0
  opts.onProgress?.(0, total)

  const evaluate = async (engine: EngineClient, i: number) => {
    if (opts.signal.cancelled) throw new Error('cancelled')
    const key = `${opts.cacheTag ?? engine.choice}|d${opts.depth}|pv${multiPv}|${fens[i]}`
    let evalResult = opts.cache ? await opts.cache.get(key) : null
    if (!evalResult) {
      evalResult = await engine.analyse(fens[i], opts.depth, opts.signal, { multiPv, movetime: movetimeFor(opts.depth) })
      if (opts.cache) void opts.cache.put(key, evalResult)
    }
    results[i] = evalResult
    opts.onProgress?.(++done, total)
  }
  let next = 0
  await Promise.all(
    pool.map(async (engine) => {
      await engine.init()
      while (next < total) {
        const start = next
        next += CHUNK
        for (let i = start; i < Math.min(total, start + CHUNK); i++) await evaluate(engine, i)
      }
    }),
  )
  if (opts.signal.cancelled) throw new Error('cancelled')
  const positions: PlyReview[] = fens.map((fen, i) => positionToReview(i, fen, results[i]))

  const moveReviews: MoveReview[] = classifyGame(moves, positions, ctx)

  // Coach commentary per move (uses the same position/line data as the UI).
  for (const mr of moveReviews) {
    const before = positions[mr.ply - 1]
    const after = positions[mr.ply]
    if (!before || !after) continue
    const bestSan = before.lines[0]?.pvSan[0]
    const bestLine = (before.lines[0]?.pvSan ?? []).slice(0, 5).join(' ')
    const input = { review: mr, before, after, bestSan, bestLine }
    mr.speech = coachSpeech(input)
    if (KEY_CLASSES.includes(mr.classification)) {
      mr.explain = coachExplain(input)
      mr.isKeyMove = true
    }
  }

  const acc = summarizeAccuracy(moveReviews)
  const counts = {
    white: countClassifications(moveReviews, 'w'),
    black: countClassifications(moveReviews, 'b'),
  }
  // ACPL: mean centipawn loss per move — engine-best eval vs played-move eval,
  // from the mover's perspective, capped at 1000cp per move (missed mates don't explode it).
  const cpLosses = { w: [] as number[], b: [] as number[] }
  for (const mr of moveReviews) {
    const before = positions[mr.ply - 1]
    const after = positions[mr.ply]
    if (!before || !after) continue
    const mover = mr.move.color
    const bestCp = cpFor(before.lines[0]?.whiteCp ?? before.whiteCp, mover)
    const playedCp = cpFor(after.whiteCp, mover)
    cpLosses[mover].push(Math.min(1000, Math.max(0, bestCp - playedCp)))
  }
  const acpl = {
    white: meanCpLoss(cpLosses.w),
    black: meanCpLoss(cpLosses.b),
  }
  return {
    positions,
    moves: moveReviews,
    whiteAccuracy: acc.white,
    blackAccuracy: acc.black,
    depth: opts.depth,
    counts,
    gameRating: {
      white: gameRating(acc.white, { elo: ctx.whiteElo, speed: ctx.speed }),
      black: gameRating(acc.black, { elo: ctx.blackElo, speed: ctx.speed }),
    },
    acpl,
    skills: computeSkills(moves, positions),
    advanced: computeAdvanced(moveReviews, positions),
  }
}

function countClassifications(moves: MoveReview[], color: 'w' | 'b') {
  const out: Partial<Record<Classification, number>> = {}
  for (const m of moves) {
    if (m.move.color !== color) continue
    out[m.classification] = (out[m.classification] ?? 0) + 1
  }
  return out
}
