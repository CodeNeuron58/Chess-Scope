/**
 * "My games" opening explorer: move statistics per position, computed from
 * the local library only (nothing leaves the browser).
 */
import { Chess } from 'chess.js'
import type { Color, GameResult, StoredGame } from './types'
import { userColorOf } from './stats'

interface MoveTally {
  san: string
  uci: string
  white: number
  draws: number
  black: number
}

interface PositionEntry {
  games: { id: string; result: GameResult; color?: Color }[]
  moves: Map<string, MoveTally>
}

export type ExplorerIndex = Map<string, PositionEntry>

/** Placement, side to move and castling rights — enough to identify an opening position. */
export function positionKey(fen: string): string {
  return fen.split(' ').slice(0, 3).join(' ')
}

export function buildExplorerIndex(games: StoredGame[], accountNames: string[], maxPlies = 30): ExplorerIndex {
  const index: ExplorerIndex = new Map()
  for (const g of games) {
    let history: { before: string; san: string; lan: string }[]
    try {
      const c = new Chess()
      c.loadPgn(g.pgn)
      history = c.history({ verbose: true }).slice(0, maxPlies)
    } catch {
      continue
    }
    const color = userColorOf(g, accountNames)
    for (const m of history) {
      const key = positionKey(m.before)
      let entry = index.get(key)
      if (!entry) {
        entry = { games: [], moves: new Map() }
        index.set(key, entry)
      }
      entry.games.push({ id: g.id, result: g.result, color })
      let t = entry.moves.get(m.lan)
      if (!t) {
        t = { san: m.san, uci: m.lan, white: 0, draws: 0, black: 0 }
        entry.moves.set(m.lan, t)
      }
      if (g.result === '1-0') t.white++
      else if (g.result === '0-1') t.black++
      else t.draws++
    }
  }
  return index
}

export interface LocalExplorer {
  moves: (MoveTally & { total: number })[]
  /** Library games that reached this position. */
  reached: number
  /** The user's points and counted games from here (games with a known side). */
  userPoints: number
  userGames: number
}

export function lookupExplorer(index: ExplorerIndex, fen: string): LocalExplorer {
  const entry = index.get(positionKey(fen))
  if (!entry) return { moves: [], reached: 0, userPoints: 0, userGames: 0 }
  let userPoints = 0
  let userGames = 0
  for (const g of entry.games) {
    if (!g.color || g.result === '*') continue
    userGames++
    if (g.result === '1/2-1/2') userPoints += 0.5
    else if ((g.result === '1-0') === (g.color === 'w')) userPoints += 1
  }
  const moves = [...entry.moves.values()]
    .map((m) => ({ ...m, total: m.white + m.draws + m.black }))
    .sort((a, b) => b.total - a.total)
  return { moves, reached: entry.games.length, userPoints, userGames }
}
