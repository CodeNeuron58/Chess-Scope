import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReviewResult } from '../types'
import type { Accounts, ReviewSummary, StoredGame } from '../library/types'
import { clearLibrary, deleteGames, getReview, loadAllGames, putGames, putReview } from '../library/db'
import { fetchLichessGames } from '../library/lichess'
import { chesscomToStored, fetchRecentGames } from '../chesscom/api'
import { usePersistedState } from './useSettings'

export type SyncSource = 'chesscom' | 'lichess'

export interface Library {
  games: StoredGame[]
  byId: Map<string, StoredGame>
  loaded: boolean
  /** Add or refresh games; existing review data and progress are kept. Returns ids that were new. */
  upsert: (games: StoredGame[]) => Promise<string[]>
  update: (id: string, patch: Partial<StoredGame>) => void
  remove: (ids: string[]) => Promise<void>
  clear: () => Promise<void>
  saveReview: (id: string, result: ReviewResult, summary: ReviewSummary) => Promise<void>
  loadReview: (id: string) => Promise<ReviewResult | null>
  /** Import recent games from connected accounts. Resolves to the new game ids (newest first) and any error. */
  sync: (only?: SyncSource, override?: Accounts) => Promise<{ fresh: string[]; error: string }>
  syncing: boolean
  syncError: string
  lastSync: Partial<Record<SyncSource, number>>
}

const STALE_MS = 15 * 60_000

function merge(existing: StoredGame | undefined, incoming: StoredGame): StoredGame {
  if (!existing) return incoming
  return {
    ...existing,
    ...incoming,
    addedAt: existing.addedAt,
    summary: incoming.summary ?? existing.summary,
    lastPly: existing.lastPly,
    lastOpenedAt: existing.lastOpenedAt,
    userColor: incoming.userColor ?? existing.userColor,
  }
}

export function useLibrary(accounts: Accounts): Library {
  const [games, setGames] = useState<StoredGame[]>([])
  const [loaded, setLoaded] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState('')
  const [lastSync, setLastSync] = usePersistedState<Partial<Record<SyncSource, number>>>('lastSync', {})
  // callbacks read the latest values through refs; upsert/update also write gamesRef synchronously
  const gamesRef = useRef(games)
  const accountsRef = useRef(accounts)
  useEffect(() => {
    gamesRef.current = games
  }, [games])
  useEffect(() => {
    accountsRef.current = accounts
  }, [accounts])

  useEffect(() => {
    let alive = true
    loadAllGames()
      .then((all) => {
        if (alive) setGames(all)
      })
      .catch(() => {
        /* IndexedDB unavailable: the library stays in memory for this session */
      })
      .finally(() => {
        if (alive) setLoaded(true)
      })
    return () => {
      alive = false
    }
  }, [])

  const byId = useMemo(() => new Map(games.map((g) => [g.id, g])), [games])

  const upsert = useCallback(async (incoming: StoredGame[]) => {
    const current = new Map(gamesRef.current.map((g) => [g.id, g]))
    const fresh: string[] = []
    const merged = incoming.map((g) => {
      if (!current.has(g.id)) fresh.push(g.id)
      return merge(current.get(g.id), g)
    })
    for (const g of merged) current.set(g.id, g)
    const next = [...current.values()]
    gamesRef.current = next
    setGames(next)
    try {
      await putGames(merged)
    } catch {
      /* best effort */
    }
    return fresh
  }, [])

  const update = useCallback((id: string, patch: Partial<StoredGame>) => {
    const prev = gamesRef.current.find((g) => g.id === id)
    if (!prev) return
    const next = { ...prev, ...patch }
    gamesRef.current = gamesRef.current.map((g) => (g.id === id ? next : g))
    setGames(gamesRef.current)
    void putGames([next]).catch(() => undefined)
  }, [])

  const remove = useCallback(async (ids: string[]) => {
    const drop = new Set(ids)
    gamesRef.current = gamesRef.current.filter((g) => !drop.has(g.id))
    setGames(gamesRef.current)
    await deleteGames(ids).catch(() => undefined)
  }, [])

  const clear = useCallback(async () => {
    gamesRef.current = []
    setGames([])
    await clearLibrary().catch(() => undefined)
  }, [])

  const saveReview = useCallback(
    async (id: string, result: ReviewResult, summary: ReviewSummary) => {
      update(id, { summary })
      await putReview(id, result).catch(() => undefined)
    },
    [update],
  )

  const sync = useCallback(
    async (only?: SyncSource, override?: Accounts) => {
      const accounts = override ?? accountsRef.current
      const jobs: Promise<{ source: SyncSource; games: StoredGame[] }>[] = []
      const cc = accounts.chesscom.trim()
      const li = accounts.lichess.trim()
      if (cc && (!only || only === 'chesscom')) {
        jobs.push(
          fetchRecentGames(cc, 2, accounts.chesscomProxy).then((list) => ({
            source: 'chesscom' as const,
            games: list.map((g) => chesscomToStored(g, cc)).filter((g): g is StoredGame => g !== null),
          })),
        )
      }
      if (li && (!only || only === 'lichess')) {
        jobs.push(fetchLichessGames(li, 60, accounts.lichessToken || undefined).then((list) => ({ source: 'lichess' as const, games: list })))
      }
      if (jobs.length === 0) return { fresh: [], error: '' }
      setSyncing(true)
      setSyncError('')
      const results = await Promise.allSettled(jobs)
      const imported: StoredGame[] = []
      const errors: string[] = []
      const stamps: Partial<Record<SyncSource, number>> = {}
      for (const r of results) {
        if (r.status === 'fulfilled') {
          imported.push(...r.value.games)
          stamps[r.value.source] = Date.now()
        } else {
          errors.push(r.reason instanceof Error ? r.reason.message : String(r.reason))
        }
      }
      const playedAt = new Map(imported.map((g) => [g.id, g.playedAt]))
      const fresh = (await upsert(imported)).sort((a, b) => (playedAt.get(b) ?? 0) - (playedAt.get(a) ?? 0))
      setLastSync((s) => ({ ...s, ...stamps }))
      setSyncError(errors.join(' '))
      setSyncing(false)
      return { fresh, error: errors.join(' ') }
    },
    [upsert, setLastSync],
  )

  const loadReview = useCallback((id: string) => getReview(id), [])

  return { games, byId, loaded, upsert, update, remove, clear, saveReview, loadReview, sync, syncing, syncError, lastSync }
}

/** True when a connected account has not synced in the last 15 minutes. */
export function syncIsStale(accounts: Accounts, lastSync: Partial<Record<SyncSource, number>>, now = Date.now()): boolean {
  const stale = (t?: number) => !t || now - t > STALE_MS
  return (!!accounts.chesscom.trim() && stale(lastSync.chesscom)) || (!!accounts.lichess.trim() && stale(lastSync.lichess))
}
