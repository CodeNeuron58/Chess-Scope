/**
 * Engine downloads with progress, stored once per browser.
 *
 * The full Stockfish build is ~99 MB. Browsers' HTTP caches refuse entries that
 * large (Chrome caps an entry at 1/8 of its cache), so left to themselves every
 * engine worker re-downloaded it, on every visit. Instead the main thread
 * downloads each engine's WebAssembly once (reporting progress), keeps it in
 * Cache Storage, and hands the workers a local blob: URL to it.
 */
import type { EngineChoice } from './engineClient'

interface Asset {
  file: string
  approxBytes: number
}

/**
 * The WebAssembly each engine loads (via the worker URL's #hash), plus files the
 * engine fetches by itself (SF16's network), which are only pre-fetched so the
 * download shows progress.
 */
const ASSETS: Record<EngineChoice, { wasm: Asset; extra: Asset[] }> = {
  'sf19-full': { wasm: { file: 'stockfish-19-single.wasm', approxBytes: 99_169_054 }, extra: [] },
  'sf19-lite': { wasm: { file: 'stockfish-19-lite-single.wasm', approxBytes: 1_845_971 }, extra: [] },
  sf16: {
    wasm: { file: 'stockfish-nnue-16-single.wasm', approxBytes: 575_029 },
    extra: [{ file: 'nn-5af11540bbfe.nnue', approxBytes: 40_119_326 }],
  },
}

/** Bump when the engine builds change so browsers fetch the new files. */
const CACHE_NAME = 'owlchess-engines-v1'
const CACHE_PREFIX = 'owlchess-engines-'
/** Stored alongside each file to detect a truncated entry. */
const SIZE_HEADER = 'X-Owlchess-Bytes'

export interface DownloadState {
  choice: EngineChoice
  loaded: number
  total: number
  status: 'downloading' | 'done' | 'error'
  error?: string
}

type Listener = (state: DownloadState) => void

const inflight = new Map<EngineChoice, Promise<string>>()
const listeners = new Set<Listener>()
let latest: DownloadState | null = null

function emit(state: DownloadState) {
  latest = state
  for (const l of listeners) l(state)
}

/** Subscribe to download progress; returns an unsubscribe function. */
export function onEngineDownload(listener: Listener): () => void {
  listeners.add(listener)
  if (latest) listener(latest)
  return () => listeners.delete(listener)
}

export function engineAssetUrl(file: string): string {
  return `${import.meta.env.BASE_URL}engines/${file}`
}

/** Engines this browser has downloaded and stored before (localStorage). */
const DOWNLOADED_KEY = 'owlchess.enginesDownloaded'

function downloadedList(): EngineChoice[] {
  try {
    const raw = localStorage.getItem(DOWNLOADED_KEY)
    return raw ? (JSON.parse(raw) as EngineChoice[]) : []
  } catch {
    return []
  }
}

/** True when this browser downloaded the engine before, so it is most likely stored. */
export function engineDownloadedBefore(choice: EngineChoice): boolean {
  return downloadedList().includes(choice)
}

function setDownloaded(choice: EngineChoice, on: boolean) {
  const list = downloadedList().filter((c) => c !== choice)
  try {
    localStorage.setItem(DOWNLOADED_KEY, JSON.stringify(on ? [...list, choice] : list))
  } catch {
    // storage unavailable: the next visit simply treats the engine as not downloaded
  }
}

/** Cache Storage, or null where it is unavailable (insecure origins, some private modes). */
async function openCache(): Promise<Cache | null> {
  try {
    if (typeof caches === 'undefined') return null
    const cache = await caches.open(CACHE_NAME)
    void dropOldCaches()
    return cache
  } catch {
    return null
  }
}

let oldDropped = false
async function dropOldCaches() {
  if (oldDropped) return
  oldDropped = true
  try {
    for (const name of await caches.keys()) {
      if (name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME) await caches.delete(name)
    }
  } catch {
    // best effort
  }
}

/** Read a response body, reporting decoded bytes as they arrive. */
async function readWithProgress(res: Response, onBytes: (loaded: number) => void): Promise<Uint8Array[]> {
  if (!res.body) {
    const all = new Uint8Array(await res.arrayBuffer())
    onBytes(all.byteLength)
    return [all]
  }
  const chunks: Uint8Array[] = []
  const reader = res.body.getReader()
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.byteLength
    onBytes(loaded)
  }
  return chunks
}

async function fetchOk(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`Could not download the engine (${res.status} for ${url.split('/').pop()})`)
  return res
}

/** The engine's WebAssembly as a Blob: from Cache Storage, or downloaded and stored there. */
async function wasmBlob(cache: Cache | null, url: string, onBytes: (loaded: number) => void): Promise<{ blob: Blob; stored: boolean }> {
  const hit = await cache?.match(url).catch(() => undefined)
  if (hit) {
    const blob = await hit.blob()
    if (String(blob.size) === hit.headers.get(SIZE_HEADER)) {
      onBytes(blob.size)
      return { blob, stored: true }
    }
  }
  const chunks = await readWithProgress(await fetchOk(url), onBytes)
  const blob = new Blob(chunks as BlobPart[], { type: 'application/wasm' })
  let stored = false
  if (cache) {
    try {
      const headers = { 'Content-Type': 'application/wasm', [SIZE_HEADER]: String(blob.size) }
      await cache.put(url, new Response(blob, { headers }))
      stored = true
    } catch {
      // over quota: this visit still works from memory, the next one downloads again
    }
  }
  return { blob, stored }
}

/**
 * Download (or load from storage) an engine once; concurrent callers share it.
 * Resolves to the URL its workers load the WebAssembly from.
 */
export function ensureEngineDownloaded(choice: EngineChoice): Promise<string> {
  const existing = inflight.get(choice)
  if (existing) return existing
  const { wasm, extra } = ASSETS[choice]
  const assets = [wasm, ...extra]
  const total = assets.reduce((s, a) => s + a.approxBytes, 0)
  const progress = assets.map(() => 0)
  const report = (i: number) => (loaded: number) => {
    progress[i] = Math.min(loaded, assets[i].approxBytes)
    emit({ choice, loaded: progress.reduce((s, x) => s + x, 0), total, status: 'downloading' })
  }
  const job = (async () => {
    const cache = await openCache()
    const [{ blob, stored }] = await Promise.all([
      wasmBlob(cache, engineAssetUrl(wasm.file), report(0)),
      // files the engine fetches itself: only warmed here so the download shows progress
      ...extra.map(async (a, i) => {
        await readWithProgress(await fetchOk(engineAssetUrl(a.file), { cache: 'force-cache' }), report(i + 1))
      }),
    ])
    setDownloaded(choice, stored)
    emit({ choice, loaded: total, total, status: 'done' })
    return URL.createObjectURL(blob)
  })().catch((e: unknown) => {
    inflight.delete(choice) // allow a retry
    const raw = e instanceof Error ? e.message : String(e)
    // fetch() rejects with a bare TypeError ("Failed to fetch") when offline or blocked
    const error = /^(Could not|The engine)/.test(raw)
      ? raw
      : 'Couldn’t download the chess engine. Check your connection, then try again.'
    emit({ choice, loaded: 0, total, status: 'error', error })
    throw new Error(error)
  })
  inflight.set(choice, job)
  return job
}

/** Bytes of engine files stored in this browser. */
export async function storedEngineBytes(): Promise<number> {
  const cache = await openCache()
  if (!cache) return 0
  let total = 0
  for (const req of await cache.keys()) {
    const res = await cache.match(req)
    total += Number(res?.headers.get(SIZE_HEADER)) || 0
  }
  return total
}

/** Delete the stored engines; engines already running keep working, and they download again when next needed. */
export async function removeStoredEngines(): Promise<void> {
  try {
    localStorage.removeItem(DOWNLOADED_KEY)
  } catch {
    // nothing stored
  }
  if (typeof caches !== 'undefined') await caches.delete(CACHE_NAME).catch(() => false)
}
