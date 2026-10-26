/**
 * Aggregations over reviewed library games for Home and Insights.
 * Everything is computed from the user's side of each game; "opponents"
 * figures come from the other side of the same games.
 */
import { gameRating } from '../analysis/accuracy'
import type { Classification } from '../types'
import { colorOfAccount, openingFamily, outcomeFor } from './pgnMeta'
import { themeLabel } from './summary'
import type { Color, DrillItem, MoveStat, ReviewSummary, Speed, StoredGame } from './types'

export interface UserGame {
  game: StoredGame
  color: Color
  summary: ReviewSummary
}

const DAY = 86_400_000

export function userColorOf(game: StoredGame, accountNames: string[]): Color | undefined {
  return game.userColor ?? colorOfAccount(game.white, game.black, accountNames)
}

/** Reviewed games where we know which side the user played, newest first. */
export function userGames(games: StoredGame[], accountNames: string[]): UserGame[] {
  const out: UserGame[] = []
  for (const game of games) {
    if (!game.summary) continue
    const color = userColorOf(game, accountNames)
    if (color) out.push({ game, color, summary: game.summary })
  }
  return out.sort((a, b) => b.game.playedAt - a.game.playedAt)
}

export function inWindow(list: UserGame[], fromMs: number, toMs: number): UserGame[] {
  return list.filter((u) => u.game.playedAt >= fromMs && u.game.playedAt < toMs)
}

export function bySpeed(list: UserGame[], speed: Speed | 'all'): UserGame[] {
  if (speed === 'all') return list
  if (speed === 'classical') return list.filter((u) => u.game.speed === 'classical' || u.game.speed === 'daily')
  return list.filter((u) => u.game.speed === speed)
}

const side = (c: Color) => (c === 'w' ? 'white' : 'black')
const other = (c: Color): Color => (c === 'w' ? 'b' : 'w')
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN)

export function accuracyOf(u: UserGame, who: 'me' | 'opp' = 'me'): number {
  return u.summary.accuracy[side(who === 'me' ? u.color : other(u.color))]
}

function countOf(u: UserGame, cls: Classification): number {
  return u.summary.counts[side(u.color)][cls] ?? 0
}

export interface Kpis {
  games: number
  accuracy: number
  score: number
  blundersPerGame: number
  rating: number
}

export function kpis(list: UserGame[]): Kpis {
  const accuracy = mean(list.map((u) => accuracyOf(u)))
  const results = list.map((u) => outcomeFor(u.game.result, u.color)).filter((r) => r !== null)
  const points = results.reduce((s, r) => s + (r === 'W' ? 1 : r === 'D' ? 0.5 : 0), 0)
  return {
    games: list.length,
    accuracy,
    score: results.length ? (points / results.length) * 100 : NaN,
    blundersPerGame: mean(list.map((u) => countOf(u, 'blunder'))),
    rating: Number.isNaN(accuracy) ? NaN : gameRating(accuracy),
  }
}

export interface SeriesPoint {
  label: string
  me: number
  opp: number
  games: number
}

/** Accuracy over time: up to `buckets` evenly spaced time buckets (oldest first). */
export function accuracySeries(list: UserGame[], fromMs: number, toMs: number, buckets = 12): SeriesPoint[] {
  if (list.length === 0) return []
  const sorted = [...list].sort((a, b) => a.game.playedAt - b.game.playedAt)
  if (sorted.length <= buckets) {
    return sorted.map((u) => ({ label: shortDate(u.game.playedAt), me: accuracyOf(u), opp: accuracyOf(u, 'opp'), games: 1 }))
  }
  const start = Math.min(fromMs, sorted[0].game.playedAt)
  const span = Math.max(1, toMs - start)
  const out: SeriesPoint[] = []
  for (let b = 0; b < buckets; b++) {
    const lo = start + (span * b) / buckets
    const hi = start + (span * (b + 1)) / buckets
    const inB = sorted.filter((u) => u.game.playedAt >= lo && (u.game.playedAt < hi || (b === buckets - 1 && u.game.playedAt <= hi)))
    if (inB.length === 0) continue
    out.push({
      label: shortDate(hi),
      me: mean(inB.map((u) => accuracyOf(u))),
      opp: mean(inB.map((u) => accuracyOf(u, 'opp'))),
      games: inB.length,
    })
  }
  return out
}

export function shortDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export interface SkillRow {
  key: string
  label: string
  hint: string
  me: number
  opp: number
}

function movesOf(list: UserGame[], who: 'me' | 'opp'): MoveStat[] {
  return list.flatMap((u) => {
    const c = who === 'me' ? u.color : other(u.color)
    return u.summary.moves.filter((m) => m.c === c)
  })
}

function phaseMean(list: UserGame[], who: 'me' | 'opp', key: 'opening' | 'tactics' | 'strategy' | 'endgame'): number {
  let sum = 0
  let n = 0
  for (const u of list) {
    const p = u.summary.phases[side(who === 'me' ? u.color : other(u.color))]
    const count = p.counts[key]
    if (count > 0) {
      sum += p[key] * count
      n += count
    }
  }
  return n ? sum / n : NaN
}

/** Skill scores (accuracy in each kind of position) for the user and their opponents. */
export function skills(list: UserGame[]): SkillRow[] {
  const rows: SkillRow[] = []
  const phase = (key: 'opening' | 'tactics' | 'strategy' | 'endgame', label: string, hint: string) =>
    rows.push({ key, label, hint, me: phaseMean(list, 'me', key), opp: phaseMean(list, 'opp', key) })
  phase('opening', 'Opening', 'First 8 moves')
  phase('tactics', 'Tactics', 'Positions with captures or checks')
  phase('strategy', 'Strategy', 'Quiet positions')
  phase('endgame', 'Endgame', 'Little material left')
  const filtered = (who: 'me' | 'opp', pred: (m: MoveStat) => boolean) => mean(movesOf(list, who).filter(pred).map((m) => m.acc))
  rows.push({
    key: 'defense',
    label: 'Defense',
    hint: 'Moves played while worse',
    me: filtered('me', (m) => m.win < 40),
    opp: filtered('opp', (m) => m.win < 40),
  })
  rows.push({
    key: 'conversion',
    label: 'Conversion',
    hint: 'Moves played while winning',
    me: filtered('me', (m) => m.win > 70),
    opp: filtered('opp', (m) => m.win > 70),
  })
  return rows
}

export interface PhaseBars {
  key: MoveStat['phase']
  label: string
  white: number
  black: number
}

/** User accuracy per game phase, split by the colour they played. */
export function phaseAccuracy(list: UserGame[]): PhaseBars[] {
  const of = (color: Color, phase: MoveStat['phase']) =>
    mean(list.filter((u) => u.color === color).flatMap((u) => u.summary.moves.filter((m) => m.c === color && m.phase === phase).map((m) => m.acc)))
  return (['opening', 'middlegame', 'endgame'] as const).map((key) => ({
    key,
    label: key[0].toUpperCase() + key.slice(1),
    white: of('w', key),
    black: of('b', key),
  }))
}

function userMistakes(list: UserGame[]): DrillItem[] {
  return list.flatMap((u) => u.summary.mistakes.filter((m) => m.color === u.color))
}

export interface Leak {
  key: string
  label: string
  share: number
}

/** Where the user's lost win% went, by cause (shares sum to 100). */
export function leaks(list: UserGame[]): Leak[] {
  const buckets: Record<string, { label: string; loss: number }> = {
    time: { label: 'Time trouble', loss: 0 },
    hanging: { label: 'Hanging pieces', loss: 0 },
    tactics: { label: 'Missed tactics', loss: 0 },
    wins: { label: 'Missed wins', loss: 0 },
    endgame: { label: 'Endgame technique', loss: 0 },
    positional: { label: 'Positional play', loss: 0 },
  }
  let total = 0
  for (const m of userMistakes(list)) {
    let key = 'positional'
    if (m.clock !== undefined && m.clock < 30) key = 'time'
    else if (m.theme === 'hanging') key = 'hanging'
    else if (m.theme === 'mate' || m.theme === 'fork' || m.theme === 'tactic') key = 'tactics'
    else if (m.theme === 'win') key = 'wins'
    else if (m.phase === 'endgame') key = 'endgame'
    buckets[key].loss += m.winLoss
    total += m.winLoss
  }
  if (total <= 0) return []
  return Object.entries(buckets)
    .map(([key, b]) => ({ key, label: b.label, share: (b.loss / total) * 100 }))
    .filter((l) => l.share > 0)
    .sort((a, b) => b.share - a.share)
}

export interface TimeStats {
  avgSeconds: number
  lowClockShare: number
  errorsInTimeTrouble: number
  accuracyAfterMistake: number
}

export function timeStats(list: UserGame[]): TimeStats {
  const spent: number[] = []
  let movesWithClock = 0
  let lowClock = 0
  for (const u of list) {
    const inc = u.summary.clock?.inc ?? 0
    let prev = u.summary.clock?.base
    for (const m of u.summary.moves) {
      if (m.c !== u.color || m.clk === undefined) continue
      movesWithClock++
      if (m.clk < 30) lowClock++
      if (prev !== undefined) spent.push(Math.max(0, prev - m.clk + inc))
      prev = m.clk
    }
  }
  const errors = userMistakes(list).filter((m) => m.cls !== 'inaccuracy')
  const timed = errors.filter((m) => m.clock !== undefined)
  const after: number[] = []
  for (const u of list) {
    const moves = u.summary.moves
    moves.forEach((m, i) => {
      if (m.c !== u.color || !['mistake', 'blunder', 'miss'].includes(m.cls)) return
      const next = moves[i + 2]
      if (next) after.push(next.acc)
    })
  }
  return {
    avgSeconds: mean(spent),
    lowClockShare: movesWithClock ? (lowClock / movesWithClock) * 100 : NaN,
    errorsInTimeTrouble: timed.length ? (timed.filter((m) => (m.clock ?? 99) < 30).length / timed.length) * 100 : NaN,
    accuracyAfterMistake: mean(after),
  }
}

export interface OpeningRow {
  name: string
  eco?: string
  games: number
  win: number
  draw: number
  loss: number
  score: number
  accuracy: number
  commonMistake: string
}

export function openingRows(list: UserGame[], color: Color, limit = 6): OpeningRow[] {
  const groups = new Map<string, UserGame[]>()
  for (const u of list) {
    if (u.color !== color) continue
    const fam = openingFamily(u.game.opening)
    groups.set(fam, [...(groups.get(fam) ?? []), u])
  }
  const rows: OpeningRow[] = []
  for (const [name, us] of groups) {
    const res = us.map((u) => outcomeFor(u.game.result, color))
    const w = res.filter((r) => r === 'W').length
    const d = res.filter((r) => r === 'D').length
    const l = res.filter((r) => r === 'L').length
    const n = Math.max(1, w + d + l)
    const ecos = us.map((u) => u.game.eco).filter(Boolean) as string[]
    const tally = new Map<string, number>()
    for (const u of us) {
      const first = u.summary.mistakes.find((m) => m.color === color && m.ply <= 30 && m.cls !== 'inaccuracy')
      if (!first) continue
      const label = `${moveLabel(first.ply, first.played.san)} · ${themeLabel(first).toLowerCase()}`
      tally.set(label, (tally.get(label) ?? 0) + 1)
    }
    const common = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]
    rows.push({
      name,
      eco: mostCommon(ecos),
      games: us.length,
      win: (w / n) * 100,
      draw: (d / n) * 100,
      loss: (l / n) * 100,
      score: ((w + d / 2) / n) * 100,
      accuracy: mean(us.map((u) => accuracyOf(u))),
      commonMistake: common ? (common[1] > 1 ? `${common[0]} (${common[1]}×)` : common[0]) : 'No early mistakes',
    })
  }
  return rows.sort((a, b) => b.games - a.games).slice(0, limit)
}

function mostCommon(xs: string[]): string | undefined {
  const t = new Map<string, number>()
  for (const x of xs) t.set(x, (t.get(x) ?? 0) + 1)
  return [...t.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
}

/** "6…Nf6" / "7. Qb3" style label for a ply and SAN. */
export function moveLabel(ply: number, san: string): string {
  const n = Math.ceil(ply / 2)
  return ply % 2 === 1 ? `${n}. ${san}` : `${n}…${san}`
}

/** Window helpers for period filters. */
export function periodRange(days: number | null, now = Date.now()): { from: number; to: number; prevFrom: number } {
  if (days === null) return { from: 0, to: now + DAY, prevFrom: 0 }
  return { from: now - days * DAY, to: now + DAY, prevFrom: now - 2 * days * DAY }
}

export function startOfWeek(now = Date.now()): number {
  const d = new Date(now)
  const day = (d.getDay() + 6) % 7
  d.setHours(0, 0, 0, 0)
  return d.getTime() - day * DAY
}
