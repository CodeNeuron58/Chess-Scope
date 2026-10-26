/**
 * Drill sets built from reviewed mistakes, plus multiple-choice answers and
 * judging. A move counts as correct when it keeps the position about as good
 * as the engine's best line.
 */
import { Chess } from 'chess.js'
import { formatEval, winFor } from '../analysis/accuracy'
import { moveLabel, userColorOf } from './stats'
import type { DrillItem, DrillTheme, StoredGame } from './types'

/**
 * Max win% a drill answer may give up versus the engine's best line: anything
 * the review would call "excellent" or better (chess.com's 0.02 expected-points
 * band). Judged on win% directly: the calibrated accuracy curve (LOSS_SCALE ≈ 3)
 * would reject moves only a few centipawns off — within engine noise.
 */
export const DRILL_WIN_TOLERANCE = 2

export interface DrillCard extends DrillItem {
  opponent: string
  playedAt: number
}

const SEVERITY: Record<string, number> = { blunder: 0, miss: 1, mistake: 2, inaccuracy: 3 }

/** The user's own mistakes across reviewed games, newest game first. */
export function userDrills(games: StoredGame[], accountNames: string[]): DrillCard[] {
  const out: DrillCard[] = []
  const sorted = [...games].sort((a, b) => b.playedAt - a.playedAt)
  for (const g of sorted) {
    if (!g.summary) continue
    const color = userColorOf(g, accountNames)
    if (!color) continue
    for (const m of g.summary.mistakes) {
      if (m.color !== color) continue
      out.push({ ...m, opponent: color === 'w' ? g.black : g.white, playedAt: g.playedAt })
    }
  }
  return out
}

/** Attach game context to drills from a single review (the "This game" set). */
export function gameDrills(items: DrillItem[], white: string, black: string, playedAt: number): DrillCard[] {
  return items.map((m) => ({ ...m, opponent: m.color === 'w' ? black : white, playedAt }))
}

function seeded(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 4294967296
  }
}

export function daySeed(date = new Date()): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()
}

/** Today's set: unsolved mistakes, worst first within the most recent games. */
export function dailySet(drills: DrillCard[], solved: Set<string>, size = 5): DrillCard[] {
  const open = drills.filter((d) => !solved.has(d.id))
  const pool = open.length >= size ? open : drills
  return [...pool]
    .slice(0, 40)
    .sort((a, b) => SEVERITY[a.cls] - SEVERITY[b.cls] || b.playedAt - a.playedAt)
    .slice(0, size)
}

export function themeSet(drills: DrillCard[], theme: DrillTheme, size = 10): DrillCard[] {
  return drills.filter((d) => d.theme === theme).slice(0, size)
}

export function mixedSet(drills: DrillCard[], seed: number, size = 5): DrillCard[] {
  const rnd = seeded(seed)
  return [...drills]
    .map((d) => ({ d, k: rnd() }))
    .sort((a, b) => a.k - b.k)
    .slice(0, size)
    .map((x) => x.d)
}

export interface Choice {
  uci: string
  san: string
  /** Eval (White's view) after this move, when the review already knows it. */
  whiteCp?: number
  mateIn?: number
  isGameMove: boolean
}

/** Four candidate moves: the engine's best, the game move, other engine lines, then forcing moves. */
export function choicesFor(item: DrillItem): Choice[] {
  const picked = new Map<string, Choice>()
  const add = (c: Choice) => {
    if (picked.size < 4 && !picked.has(c.uci)) picked.set(c.uci, c)
  }
  const [best, ...rest] = item.lines
  if (best) add({ uci: best.uci, san: best.san, whiteCp: best.whiteCp, mateIn: best.mateIn, isGameMove: best.uci === item.played.uci })
  add({ uci: item.played.uci, san: item.played.san, whiteCp: item.played.whiteCp, mateIn: item.played.mateIn, isGameMove: true })
  for (const l of rest) add({ uci: l.uci, san: l.san, whiteCp: l.whiteCp, mateIn: l.mateIn, isGameMove: l.uci === item.played.uci })
  if (picked.size < 4) {
    const rnd = seeded(item.ply * 7919 + item.fen.length)
    let legal: { lan: string; san: string; forcing: boolean }[] = []
    try {
      legal = new Chess(item.fen)
        .moves({ verbose: true })
        .map((m) => ({ lan: m.lan, san: m.san, forcing: m.san.includes('x') || m.san.includes('+') }))
    } catch {
      legal = []
    }
    const ranked = legal
      .map((m) => ({ m, k: rnd() - (m.forcing ? 0.5 : 0) }))
      .sort((a, b) => a.k - b.k)
      .map((x) => x.m)
    for (const m of ranked) add({ uci: m.lan, san: m.san, isGameMove: false })
  }
  const rnd = seeded(item.ply * 104729 + item.played.san.length)
  return [...picked.values()]
    .map((c) => ({ c, k: rnd() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.c)
}

/** Judge a candidate whose resulting evaluation is known. */
export function judge(item: DrillItem, whiteCpAfter: number): { ok: boolean; winLoss: number } {
  const bestCp = item.lines[0]?.whiteCp ?? item.played.whiteCp
  const winBest = winFor(bestCp, item.color)
  const winCand = winFor(whiteCpAfter, item.color)
  const winLoss = Math.max(0, winBest - winCand)
  return { ok: winLoss <= DRILL_WIN_TOLERANCE, winLoss }
}

export function sideLabel(item: Pick<DrillItem, 'color'>): string {
  return item.color === 'w' ? 'WHITE TO MOVE' : 'BLACK TO MOVE'
}

/** The question shown above the board. */
export function promptFor(item: DrillItem): string {
  const played = moveLabel(item.ply, item.played.san)
  switch (item.theme) {
    case 'mate':
      return item.mateIn && item.mateIn <= 5 ? `Mate in ${item.mateIn}. Find the first move.` : 'There is a forced mate. Find the first move.'
    case 'fork':
      return `You played ${played} here. Find the fork.`
    case 'hanging':
      return `You played ${played} and left a piece hanging. Find a safer move.`
    case 'tactic':
      return `You played ${played} here. There was a tactic — find it.`
    case 'win':
      return `You played ${played} and let the win slip. Find the move that keeps it.`
    default:
      return `You played ${played} here. Find a better move.`
  }
}

export function hintFor(item: DrillItem): string {
  switch (item.theme) {
    case 'mate':
      return 'There is a forced mate. Start with the most forcing checks.'
    case 'fork':
      return 'One move attacks two targets at once.'
    case 'hanging':
      return 'Your game move left a piece undefended. Keep everything protected.'
    case 'tactic':
      return 'Look for a forcing move: a capture or a check.'
    case 'win':
      return 'You were winning here. Look for the move that keeps the pressure on.'
    default:
      return 'No tactic here. Improve your worst piece or fix a weakness.'
  }
}

/** Explanation shown once the drill is solved or revealed. */
export function solutionText(item: DrillItem): string {
  const best = item.lines[0]
  if (!best) return ''
  const line = best.pvSan.slice(0, 6).join(' ')
  const ev = formatEval(best.whiteCp, best.mateIn)
  return `${moveLabel(item.ply, best.san)} keeps the evaluation at ${ev}. Engine line: ${line}.`
}
