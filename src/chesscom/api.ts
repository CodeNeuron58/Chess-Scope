/**
 * chess.com Public API client (https://api.chess.com/pub/...).
 * Read-only, unauthenticated, public data only — no passwords, no OAuth.
 * Optional proxy: if the user sets a proxy base URL, requests go through it
 * (useful when chess.com blocks direct browser calls from some networks).
 */

const PUB = 'https://api.chess.com/pub'

export interface CcProfile {
  username: string
  name?: string
  avatar?: string
  url: string
  joined: number
  followers: number
  country: string
}

export interface CcStats {
  blitz?: number
  rapid?: number
  bullet?: number
  daily?: number
}

export interface CcGame {
  uuid: string
  url: string
  time_class: string
  time_control: string
  rated: boolean
  end_time: number
  white: { username: string; rating: number; result: string }
  black: { username: string; rating: number; result: string }
  pgn: string
  accuracies?: { white: number; black: number }
}

function proxyBase(): string {
  try {
    return localStorage.getItem('chessscope.ccProxy')?.trim() ?? ''
  } catch {
    return ''
  }
}

async function apiGet<T>(path: string): Promise<T> {
  const proxy = proxyBase()
  const url = proxy ? `${proxy.replace(/\/$/, '')}/pub${path}` : `${PUB}${path}`
  const res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' })
  if (!res.ok) {
    if (res.status === 404) throw new Error('Not found (wrong username or no games that month).')
    if (res.status === 403)
      throw new Error('Blocked by chess.com (403). Their bot filter sometimes blocks direct browser calls — set a proxy base URL below.')
    if (res.status === 429) throw new Error('Rate limited by chess.com (429) — wait a minute and retry.')
    throw new Error(`chess.com API error ${res.status}`)
  }
  return (await res.json()) as T
}

export async function fetchProfile(username: string): Promise<CcProfile> {
  return apiGet<CcProfile>(`/player/${encodeURIComponent(username.toLowerCase())}`)
}

export async function fetchStats(username: string): Promise<CcStats> {
  try {
    const raw = await apiGet<Record<string, { last?: { rating?: number } }>>(
      `/player/${encodeURIComponent(username.toLowerCase())}/stats`,
    )
    const pick = (key: string) => raw?.[key]?.last?.rating
    return { blitz: pick('chess_blitz'), rapid: pick('chess_rapid'), bullet: pick('chess_bullet'), daily: pick('chess_daily') }
  } catch {
    return {}
  }
}

export async function fetchArchive(username: string, ym: string): Promise<CcGame[]> {
  // 404 = no games that month; treat as empty.
  try {
    const data = await apiGet<{ games: CcGame[] }>(`/player/${encodeURIComponent(username.toLowerCase())}/games/${ym}`)
    return data.games ?? []
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Not found')) return []
    throw e
  }
}

/** Last `months` months of games, newest first, deduped by uuid. */
export async function fetchRecentGames(username: string, months: number): Promise<CcGame[]> {
  const out = new Map<string, CcGame>()
  const now = new Date()
  const yms: string[] = []
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    yms.push(`${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const results = await Promise.allSettled(yms.map((ym) => fetchArchive(username, ym)))
  for (const r of results) {
    if (r.status === 'fulfilled') for (const g of r.value) out.set(g.uuid, g)
  }
  return [...out.values()].sort((a, b) => b.end_time - a.end_time)
}

const DRAWS = new Set(['draw', 'stalemate', 'agreed', 'repetition', 'insufficient', '50move'])

export function resultFor(game: CcGame, username: string): 'win' | 'loss' | 'draw' {
  const me = game.white.username.toLowerCase() === username.toLowerCase() ? game.white : game.black
  if (me.result === 'win') return 'win'
  if (DRAWS.has(me.result)) return 'draw'
  return 'loss'
}

export function opponentOf(game: CcGame, username: string): { name: string; rating: number } {
  return game.white.username.toLowerCase() === username.toLowerCase()
    ? { name: game.black.username, rating: game.black.rating }
    : { name: game.white.username, rating: game.white.rating }
}

export function myColor(game: CcGame, username: string): 'w' | 'b' {
  return game.white.username.toLowerCase() === username.toLowerCase() ? 'w' : 'b'
}

export function tcLabel(tc: string): string {
  if (tc.includes('/')) return 'Daily'
  const [baseS, incS] = tc.split('+')
  const base = Number(baseS)
  if (Number.isNaN(base)) return tc
  const inc = incS ? ` | ${incS}` : ''
  if (base < 60) return `${base} sec${inc}`
  return `${Math.max(1, Math.round(base / 60))} min${inc}`
}

export function dateLabel(endTime: number): string {
  return new Date(endTime * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
