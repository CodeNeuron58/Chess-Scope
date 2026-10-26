/**
 * Lichess public API client (https://lichess.org/api). Game export is
 * unauthenticated; the opening explorer has required a personal API token
 * since March 2026, so it is only used when the user has added one.
 */
import type { GameResult, StoredGame } from './types'
import { parseGame } from './pgnMeta'

interface LiPlayer {
  user?: { name: string }
  rating?: number
  aiLevel?: number
}

interface LiGame {
  id: string
  variant: string
  speed: string
  createdAt: number
  lastMoveAt?: number
  winner?: 'white' | 'black'
  status: string
  players: { white: LiPlayer; black: LiPlayer }
  opening?: { eco: string; name: string }
  clock?: { initial: number; increment: number }
  pgn?: string
}

function authHeaders(token: string | undefined): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function playerName(p: LiPlayer): string {
  if (p.user?.name) return p.user.name
  if (p.aiLevel) return `Stockfish level ${p.aiLevel}`
  return 'Anonymous'
}

/** Most recent standard games of a Lichess user, newest first. */
export async function fetchLichessGames(username: string, max = 60, token?: string): Promise<StoredGame[]> {
  const params = new URLSearchParams({
    max: String(max),
    pgnInJson: 'true',
    opening: 'true',
    clocks: 'true',
    perfType: 'bullet,blitz,rapid,classical,correspondence',
  })
  const res = await fetch(`https://lichess.org/api/games/user/${encodeURIComponent(username)}?${params}`, {
    headers: { Accept: 'application/x-ndjson', ...authHeaders(token) },
  })
  if (res.status === 404) throw new Error(`Lichess user "${username}" not found.`)
  if (res.status === 429) throw new Error('Rate limited by Lichess — wait a minute and retry.')
  if (!res.ok) throw new Error(`Lichess API error ${res.status}`)
  const text = await res.text()
  const out: StoredGame[] = []
  const me = username.toLowerCase()
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    let g: LiGame
    try {
      g = JSON.parse(line) as LiGame
    } catch {
      continue
    }
    if (g.variant !== 'standard' || !g.pgn) continue
    const stored = lichessToStored(g, me)
    if (stored) out.push(stored)
  }
  return out
}

function lichessToStored(g: LiGame, me: string): StoredGame | null {
  let meta: ReturnType<typeof parseGame>['meta']
  try {
    meta = parseGame(g.pgn ?? '').meta
  } catch {
    return null
  }
  const white = playerName(g.players.white)
  const black = playerName(g.players.black)
  const result: GameResult = g.winner === 'white' ? '1-0' : g.winner === 'black' ? '0-1' : g.status === 'started' ? '*' : '1/2-1/2'
  return {
    ...meta,
    id: `li:${g.id}`,
    source: 'lichess',
    white,
    black,
    whiteElo: g.players.white.rating,
    blackElo: g.players.black.rating,
    result,
    playedAt: g.lastMoveAt ?? g.createdAt,
    addedAt: Date.now(),
    speed: g.speed === 'correspondence' ? 'daily' : g.speed === 'ultraBullet' ? 'bullet' : (g.speed as StoredGame['speed']),
    timeControl: g.clock ? `${g.clock.initial}+${g.clock.increment}` : meta.timeControl,
    opening: g.opening?.name ?? meta.opening,
    eco: g.opening?.eco ?? meta.eco,
    userColor: white.toLowerCase() === me ? 'w' : black.toLowerCase() === me ? 'b' : undefined,
    url: `https://lichess.org/${g.id}`,
  }
}

/** Lichess game id from a game URL ("lichess.org/abcdefgh", "/abcdefghWXYZ", "/abcdefgh/black"). */
export function lichessIdFromUrl(url: string): string | null {
  const m = /lichess\.org\/(?:game\/export\/)?([a-zA-Z0-9]{8})(?:[a-zA-Z0-9]{4})?(?:[/?#]|$)/.exec(url.trim())
  return m ? m[1] : null
}

/** PGN of a single Lichess game. */
export async function fetchLichessGamePgn(id: string): Promise<string> {
  const res = await fetch(`https://lichess.org/game/export/${id}?clocks=true&evals=false&opening=true`, {
    headers: { Accept: 'application/x-chess-pgn' },
  })
  if (res.status === 404) throw new Error('That Lichess game was not found.')
  if (!res.ok) throw new Error(`Lichess API error ${res.status}`)
  return res.text()
}

export interface ExplorerMove {
  uci: string
  san: string
  white: number
  draws: number
  black: number
}

export interface ExplorerResult {
  total: number
  moves: ExplorerMove[]
  opening?: { eco: string; name: string }
}

export type ExplorerDb = 'masters' | 'lichess'

const explorerCache = new Map<string, ExplorerResult>()

/** Lichess opening explorer for a position (requires a personal API token). */
export async function fetchExplorer(db: ExplorerDb, fen: string, token: string): Promise<ExplorerResult> {
  const key = `${db}|${fen}`
  const hit = explorerCache.get(key)
  if (hit) return hit
  const params = new URLSearchParams({ fen, moves: '8', topGames: '0' })
  if (db === 'lichess') {
    params.set('variant', 'standard')
    params.set('recentGames', '0')
    params.set('speeds', 'blitz,rapid,classical')
    params.set('ratings', '1600,1800,2000,2200,2500')
  }
  const res = await fetch(`https://explorer.lichess.ovh/${db}?${params}`, { headers: authHeaders(token) })
  if (res.status === 401) throw new Error('Lichess rejected the API token. Check it in Settings.')
  if (res.status === 429) throw new Error('Explorer rate limit reached — wait a minute.')
  if (!res.ok) throw new Error(`Explorer error ${res.status}`)
  const data = (await res.json()) as {
    white: number
    draws: number
    black: number
    moves: ExplorerMove[]
    opening?: { eco: string; name: string } | null
  }
  const result: ExplorerResult = {
    total: data.white + data.draws + data.black,
    moves: data.moves.map((m) => ({ uci: m.uci, san: m.san, white: m.white, draws: m.draws, black: m.black })),
    opening: data.opening ?? undefined,
  }
  explorerCache.set(key, result)
  return result
}
