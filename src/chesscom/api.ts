/**
 * chess.com Public API client (https://api.chess.com/pub/...).
 * Read-only, unauthenticated, public data only — no passwords, no OAuth.
 * Optional proxy: if the user sets a proxy base URL, requests go through it
 * (useful when chess.com blocks direct browser calls from some networks).
 */
import type { StoredGame } from '../library/types'
import { parseGame } from '../library/pgnMeta'

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

export interface CcGame {
  uuid: string
  url: string
  time_class: string
  time_control: string
  rules?: string
  rated: boolean
  end_time: number
  white: { username: string; rating: number; result: string }
  black: { username: string; rating: number; result: string }
  pgn: string
  accuracies?: { white: number; black: number }
}

async function apiGet<T>(path: string, proxy: string): Promise<T> {
  const base = proxy.trim()
  const url = base ? `${base.replace(/\/$/, '')}/pub${path}` : `${PUB}${path}`
  const res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' })
  if (!res.ok) {
    if (res.status === 404) throw new Error('Not found (wrong username or no games that month).')
    if (res.status === 403)
      throw new Error('Blocked by chess.com (403). Their bot filter sometimes blocks direct browser calls — set a proxy in Settings.')
    if (res.status === 429) throw new Error('Rate limited by chess.com (429) — wait a minute and retry.')
    throw new Error(`chess.com API error ${res.status}`)
  }
  return (await res.json()) as T
}

export async function fetchProfile(username: string, proxy = ''): Promise<CcProfile> {
  return apiGet<CcProfile>(`/player/${encodeURIComponent(username.toLowerCase())}`, proxy)
}

export async function fetchArchive(username: string, ym: string, proxy = ''): Promise<CcGame[]> {
  // 404 = no games that month; treat as empty.
  try {
    const data = await apiGet<{ games: CcGame[] }>(
      `/player/${encodeURIComponent(username.toLowerCase())}/games/${ym}`,
      proxy,
    )
    return data.games ?? []
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Not found')) return []
    throw e
  }
}

/** Last `months` months of games, newest first, deduped by uuid. */
export async function fetchRecentGames(username: string, months: number, proxy = ''): Promise<CcGame[]> {
  const out = new Map<string, CcGame>()
  const now = new Date()
  const yms: string[] = []
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    yms.push(`${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const results = await Promise.allSettled(yms.map((ym) => fetchArchive(username, ym, proxy)))
  const failed = results.find((r) => r.status === 'rejected')
  if (failed && results.every((r) => r.status === 'rejected')) throw (failed as PromiseRejectedResult).reason
  for (const r of results) {
    if (r.status === 'fulfilled') for (const g of r.value) out.set(g.uuid, g)
  }
  return [...out.values()].sort((a, b) => b.end_time - a.end_time)
}

/** chess.com archive game → library record (standard chess only). */
export function chesscomToStored(g: CcGame, username: string): StoredGame | null {
  if (g.rules && g.rules !== 'chess') return null
  if (!g.pgn) return null
  let meta: ReturnType<typeof parseGame>['meta']
  try {
    meta = parseGame(g.pgn).meta
  } catch {
    return null
  }
  const me = username.toLowerCase()
  return {
    ...meta,
    id: `cc:${g.uuid}`,
    source: 'chesscom',
    white: g.white.username,
    black: g.black.username,
    whiteElo: g.white.rating,
    blackElo: g.black.rating,
    playedAt: g.end_time * 1000,
    addedAt: Date.now(),
    speed: g.time_class === 'daily' ? 'daily' : (g.time_class as StoredGame['speed']),
    timeControl: g.time_control,
    userColor: g.white.username.toLowerCase() === me ? 'w' : g.black.username.toLowerCase() === me ? 'b' : undefined,
    url: g.url,
  }
}
