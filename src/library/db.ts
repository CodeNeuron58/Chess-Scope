/**
 * Local game library in IndexedDB (no dependencies). Three stores:
 * `games` holds the light records the UI lists; `reviews` holds the full
 * ReviewResult per game so a reviewed game reopens without re-analysis;
 * `evals` caches engine results per position so repeated positions are free.
 */
import type { ReviewResult } from '../types'
import type { PositionEval } from '../engine/engineClient'
import type { StoredGame } from './types'

const DB_NAME = 'owlchess'
const VERSION = 2
const GAMES = 'games'
const REVIEWS = 'reviews'
const EVALS = 'evals'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(GAMES)) db.createObjectStore(GAMES, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(REVIEWS)) db.createObjectStore(REVIEWS)
      if (!db.objectStoreNames.contains(EVALS)) db.createObjectStore(EVALS)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      dbPromise = null
      reject(req.error ?? new Error('IndexedDB unavailable'))
    }
  })
  return dbPromise
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'))
  })
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function loadAllGames(): Promise<StoredGame[]> {
  const db = await openDb()
  return request(db.transaction(GAMES, 'readonly').objectStore(GAMES).getAll() as IDBRequest<StoredGame[]>)
}

export async function putGames(games: StoredGame[]): Promise<void> {
  if (games.length === 0) return
  const db = await openDb()
  const tx = db.transaction(GAMES, 'readwrite')
  const store = tx.objectStore(GAMES)
  for (const g of games) store.put(g)
  await done(tx)
}

export async function deleteGames(ids: string[]): Promise<void> {
  const db = await openDb()
  const tx = db.transaction([GAMES, REVIEWS], 'readwrite')
  for (const id of ids) {
    tx.objectStore(GAMES).delete(id)
    tx.objectStore(REVIEWS).delete(id)
  }
  await done(tx)
}

export async function getReview(id: string): Promise<ReviewResult | null> {
  try {
    const db = await openDb()
    const r = await request(db.transaction(REVIEWS, 'readonly').objectStore(REVIEWS).get(id))
    return (r as ReviewResult | undefined) ?? null
  } catch {
    return null
  }
}

export async function putReview(id: string, review: ReviewResult): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(REVIEWS, 'readwrite')
  // chess.js Move instances clone as plain objects; that's all the app reads from them
  tx.objectStore(REVIEWS).put(JSON.parse(JSON.stringify(review)), id)
  await done(tx)
}

/** Cached engine result for a position searched with the same engine, depth and line count. */
export async function getEval(key: string): Promise<PositionEval | null> {
  try {
    const db = await openDb()
    const r = await request(db.transaction(EVALS, 'readonly').objectStore(EVALS).get(key))
    return (r as PositionEval | undefined) ?? null
  } catch {
    return null
  }
}

export async function putEval(key: string, value: PositionEval): Promise<void> {
  try {
    const db = await openDb()
    const tx = db.transaction(EVALS, 'readwrite')
    tx.objectStore(EVALS).put(value, key)
    await done(tx)
  } catch {
    /* the cache is best-effort */
  }
}

export async function clearEvalCache(): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(EVALS, 'readwrite')
  tx.objectStore(EVALS).clear()
  await done(tx)
}

export async function evalCacheSize(): Promise<number> {
  try {
    const db = await openDb()
    return await request(db.transaction(EVALS, 'readonly').objectStore(EVALS).count())
  } catch {
    return 0
  }
}

/** Engine-result cache in the shape the review pipeline expects. */
export const evalCache = { get: getEval, put: putEval }

export async function clearLibrary(): Promise<void> {
  const db = await openDb()
  const tx = db.transaction([GAMES, REVIEWS], 'readwrite')
  tx.objectStore(GAMES).clear()
  tx.objectStore(REVIEWS).clear()
  await done(tx)
}
