/**
 * Engine downloads with progress. The full Stockfish build is ~99 MB, which the
 * engine worker would otherwise fetch silently. Fetching it here first (once per
 * engine kind, shared by every pool member) reports progress to the UI and fills
 * the browser's HTTP cache, so the workers' own request is served from cache.
 */
import type { EngineChoice } from './engineClient'

/** Large files each engine needs (the worker scripts themselves are tiny). */
const ASSETS: Record<EngineChoice, { file: string; approxBytes: number }[]> = {
  'sf19-full': [{ file: 'stockfish-19-single.wasm', approxBytes: 99_169_054 }],
  'sf19-lite': [{ file: 'stockfish-19-lite-single.wasm', approxBytes: 1_845_971 }],
  sf16: [
    { file: 'stockfish-nnue-16-single.wasm', approxBytes: 1_000_000 },
    { file: 'nn-5af11540bbfe.nnue', approxBytes: 40_000_000 },
  ],
}

export interface DownloadState {
  choice: EngineChoice
  loaded: number
  total: number
  status: 'downloading' | 'done' | 'error'
  error?: string
}

type Listener = (state: DownloadState) => void

const inflight = new Map<EngineChoice, Promise<void>>()
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

async function fetchWithProgress(url: string, approx: number, onBytes: (loaded: number, total: number) => void): Promise<void> {
  // force-cache: reuse a cached copy without revalidating; otherwise download and store it
  const res = await fetch(url, { cache: 'force-cache' })
  if (!res.ok) throw new Error(`Could not download the engine (${res.status} for ${url.split('/').pop()})`)
  const total = Number(res.headers.get('content-length')) || approx
  if (!res.body) {
    await res.arrayBuffer()
    onBytes(total, total)
    return
  }
  const reader = res.body.getReader()
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    loaded += value.byteLength
    onBytes(loaded, total)
  }
  onBytes(total, total)
}

/** Download (or confirm cached) an engine's files once; concurrent callers share it. */
export function ensureEngineDownloaded(choice: EngineChoice): Promise<void> {
  const existing = inflight.get(choice)
  if (existing) return existing
  const assets = ASSETS[choice]
  const totalApprox = assets.reduce((s, a) => s + a.approxBytes, 0)
  const progress = assets.map(() => 0)
  const sizes = assets.map((a) => a.approxBytes)
  const report = () => {
    const loaded = progress.reduce((s, x) => s + x, 0)
    const total = Math.max(totalApprox, sizes.reduce((s, x) => s + x, 0))
    emit({ choice, loaded, total, status: 'downloading' })
  }
  const job = Promise.all(
    assets.map((a, i) =>
      fetchWithProgress(engineAssetUrl(a.file), a.approxBytes, (loaded, total) => {
        progress[i] = loaded
        sizes[i] = total
        report()
      }),
    ),
  )
    .then(() => emit({ choice, loaded: totalApprox, total: totalApprox, status: 'done' }))
    .catch((e: unknown) => {
      inflight.delete(choice) // allow a retry
      const raw = e instanceof Error ? e.message : String(e)
      // fetch() rejects with a bare TypeError ("Failed to fetch") when offline or blocked
      const error = /^(Could not|The engine)/.test(raw)
        ? raw
        : 'Couldn’t download the chess engine. Check your connection, then try again.'
      emit({ choice, loaded: 0, total: totalApprox, status: 'error', error })
      throw new Error(error)
    })
  inflight.set(choice, job)
  return job
}
