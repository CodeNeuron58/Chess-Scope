import { Chess } from 'chess.js'
import type { EngineLine, PlyReview } from '../types'
import { engineAssetUrl, ensureEngineDownloaded } from './download'

/** How long the UCI handshake may take once the engine files are downloaded (WASM compile included). */
const HANDSHAKE_TIMEOUT_MS = 60_000

export interface PositionEval {
  whiteCp: number
  mateIn?: number
  lines: EngineLine[]
  /** Deepest depth at which every requested line was complete. */
  depth?: number
}

export interface AnalyseOptions {
  /** Called each time a new depth completes (live analysis). */
  onUpdate?: (update: PositionEval) => void
  /** Lines to search (MultiPV). Fewer lines is faster. Default 3. */
  multiPv?: number
  /** Stop after this many milliseconds even if the depth is not reached. */
  movetime?: number
}

interface SearchOutcome extends PositionEval {
  bestUci: string
}

interface RawLine {
  scoreCpStm: number
  mateStm?: number
  pvUci: string[]
}

const CP_MATE = 20000

export function mateToCp(mate: number): number {
  // mate > 0 means the side to move delivers mate in |mate|
  return Math.sign(mate) * (CP_MATE - Math.abs(mate) * 100)
}

export function cpToWhite(cpStm: number, turn: 'w' | 'b'): number {
  return turn === 'w' ? cpStm : -cpStm
}

function parseInfo(line: string): { depth: number; multipv: number; raw: RawLine } | null {
  if (line.includes('lowerbound') || line.includes('upperbound')) return null
  const t = line.split(/\s+/)
  let depth = 0
  let multipv = 1
  let scoreCp: number | null = null
  let mate: number | undefined
  let pv: string[] | null = null
  for (let i = 0; i < t.length; i++) {
    switch (t[i]) {
      case 'depth':
        depth = Number(t[i + 1])
        break
      case 'multipv':
        multipv = Number(t[i + 1])
        break
      case 'score':
        if (t[i + 1] === 'cp') scoreCp = Number(t[i + 2])
        else if (t[i + 1] === 'mate') mate = Number(t[i + 2])
        break
      case 'pv':
        pv = t.slice(i + 1).filter(Boolean)
        i = t.length
        break
    }
  }
  if (scoreCp === null && mate === undefined) return null
  if (!pv || pv.length === 0) return null
  return {
    depth,
    multipv,
    raw: { scoreCpStm: scoreCp ?? mateToCp(mate as number), mateStm: mate, pvUci: pv },
  }
}

function uciToSanList(fen: string, pvUci: string[]): string[] {
  const board = new Chess(fen)
  const sans: string[] = []
  for (const uci of pvUci) {
    try {
      const mv = board.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci[4] : undefined,
      })
      sans.push(mv.san)
    } catch {
      break
    }
  }
  return sans
}

function buildEval(
  fen: string,
  byDepth: Map<number, Map<number, RawLine>>,
  multiPV: number,
): SearchOutcome {
  let bestDepth = 0
  for (const d of byDepth.keys()) if (d > bestDepth) bestDepth = d
  let chosenDepth = bestDepth
  while (chosenDepth > 1) {
    const m = byDepth.get(chosenDepth)
    if (!m) {
      chosenDepth--
      continue
    }
    let complete = true
    for (let k = 1; k <= multiPV; k++) if (!m.has(k)) { complete = false; break }
    if (complete) break
    chosenDepth--
  }
  const at = byDepth.get(chosenDepth) ?? byDepth.get(bestDepth)
  const lines: EngineLine[] = []
  let whiteCp = 0
  let mateIn: number | undefined
  if (at && fen) {
    const turn = new Chess(fen).turn()
    const ks = [...at.keys()].sort((a, b) => a - b)
    for (const k of ks) {
      const raw = at.get(k)
      if (!raw) continue
      const whiteCpLine = cpToWhite(raw.scoreCpStm, turn)
      const mateInLine = raw.mateStm !== undefined ? (turn === 'w' ? raw.mateStm : -raw.mateStm) : undefined
      lines.push({
        uciFirst: raw.pvUci[0],
        pvUci: raw.pvUci,
        pvSan: uciToSanList(fen, raw.pvUci),
        whiteCp: whiteCpLine,
        mateIn: mateInLine,
      })
      if (k === 1) {
        whiteCp = whiteCpLine
        mateIn = mateInLine
      }
    }
  }
  return { whiteCp, mateIn, lines, bestUci: lines[0]?.uciFirst ?? '', depth: chosenDepth }
}

export type EngineChoice = 'sf19-full' | 'sf19-lite' | 'sf16'

/**
 * Single-threaded WASM builds. Measured in Chrome (2026-10, 16 cores): the
 * multi-threaded builds reach a fixed depth no faster — often slower — so
 * speed comes from running several engines in parallel instead (EnginePool).
 */
export const ENGINE_FILES: Record<EngineChoice, string> = {
  'sf19-full': 'stockfish-19-single.js',
  'sf19-lite': 'stockfish-19-lite-single.js',
  sf16: 'stockfish-nnue-16-single.js',
}

/**
 * Engines to run side by side for reviews: half the cores, at most 4. Four
 * single-threaded engines reviewed a 66-position game at depth 14 in ~20 s
 * versus ~165 s for one engine; eight were slower again (memory contention).
 */
export function poolSize(): number {
  if (typeof navigator === 'undefined') return 1
  const cores = navigator.hardwareConcurrency || 2
  // each full engine holds its own ~100 MB network: stay small on low-memory devices
  const memoryGb = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  const cap = memoryGb !== undefined && memoryGb <= 4 ? 2 : 4
  return Math.max(1, Math.min(cap, Math.floor(cores / 2)))
}

export class EngineClient {
  private worker: Worker | null = null
  private initResolve: (() => void) | null = null
  private initReject: ((err: Error) => void) | null = null
  private searchResolve: ((outcome: SearchOutcome) => void) | null = null
  private searchReject: ((err: Error) => void) | null = null
  private byDepth = new Map<number, Map<number, RawLine>>()
  private currentFen = ''
  readonly choice: EngineChoice

  /** Transposition table size in MB (pool members use less each). */
  private readonly hashMb: number

  constructor(choice: EngineChoice = 'sf19-full', hashMb = 128) {
    this.choice = choice
    this.hashMb = hashMb
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker
    const w = new Worker(engineAssetUrl(ENGINE_FILES[this.choice]))
    this.worker = w
    w.onmessage = (e: MessageEvent<string>) => this.onMessage(String(e.data))
    w.onerror = (e) => {
      e.preventDefault()
      this.fail(new Error(`The engine stopped working${e.message ? ` (${e.message})` : ''}. Try again or pick another engine in Settings.`))
    }
    return w
  }

  /** A broken worker: reject whoever is waiting and start fresh next time. */
  private fail(err: Error) {
    this.searchReject?.(err)
    this.searchReject = null
    this.searchResolve = null
    this.initReject?.(err)
    this.initReject = null
    this.initResolve = null
    this.worker?.terminate()
    this.worker = null
    this.ready = null
    this.multiPV = 0
  }

  private onMessage(text: string) {
    if (text.startsWith('info string')) {
      return
    }
    if (text.startsWith('info')) {
      const parsed = parseInfo(text)
      if (parsed) {
        let m = this.byDepth.get(parsed.depth)
        if (!m) {
          m = new Map()
          this.byDepth.set(parsed.depth, m)
        }
        m.set(parsed.multipv, parsed.raw)
        // the last line of a depth completes it — report progress for live analysis
        if (this.onUpdate && parsed.multipv >= this.expectedLines) {
          const { bestUci: _drop, ...update } = buildEval(this.currentFen, this.byDepth, this.expectedLines)
          this.onUpdate(update)
        }
      }
      return
    }
    if (text.startsWith('bestmove')) {
      const best = text.split(/\s+/)[1] ?? ''
      const outcome = buildEval(this.currentFen, this.byDepth, this.expectedLines)
      outcome.bestUci = best
      this.searchResolve?.(outcome)
      this.searchResolve = null
      this.searchReject = null
      return
    }
    if (text === 'uciok' || text === 'readyok') {
      this.initResolve?.()
      this.initResolve = null
      this.initReject = null
    }
  }

  /** MultiPV currently set on the engine (0 = not set since the worker started). */
  private multiPV = 0
  /** Lines the current search can produce: MultiPV capped by the legal move count. */
  private expectedLines = 3
  private onUpdate: AnalyseOptions['onUpdate'] = undefined

  private ready: Promise<void> | null = null

  /** Start the worker and configure UCI once; repeated calls share the same handshake. */
  init(): Promise<void> {
    if (!this.ready) {
      this.ready = this.handshake().catch((e) => {
        this.ready = null
        throw e
      })
    }
    return this.ready
  }

  /** Resolves on the next uciok/readyok; rejects on a worker error or after a timeout. */
  private waitForReply(what: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => this.fail(new Error(`The engine did not start (no ${what} after ${HANDSHAKE_TIMEOUT_MS / 1000} s).`)), HANDSHAKE_TIMEOUT_MS)
      this.initResolve = () => {
        clearTimeout(timer)
        resolve()
      }
      this.initReject = (err) => {
        clearTimeout(timer)
        reject(err)
      }
    })
  }

  private async handshake(): Promise<void> {
    // one shared, progress-reporting download per engine kind (pool members reuse it)
    await ensureEngineDownloaded(this.choice)
    const w = this.ensureWorker()
    const done = this.waitForReply('uciok')
    w.postMessage('uci')
    await done
    w.postMessage(`setoption name Hash value ${this.hashMb}`)
    // SF16 needs NNUE enabled explicitly; SF19 removed the option (NNUE-only).
    if (this.choice === 'sf16') w.postMessage('setoption name Use NNUE value true')
    const ready = this.waitForReply('readyok')
    w.postMessage('isready')
    await ready
  }

  async analyse(
    fen: string,
    depth: number,
    signal: { cancelled: boolean },
    opts: AnalyseOptions = {},
  ): Promise<PositionEval> {
    // Serialize: interleaved UCI searches on one worker corrupt each other.
    const run = () => this.runAnalyse(fen, depth, signal, opts)
    const result = this.taskQueue.then(run, run)
    this.taskQueue = result.catch(() => undefined)
    return result
  }

  private taskQueue: Promise<unknown> = Promise.resolve()

  private async runAnalyse(
    fen: string,
    depth: number,
    signal: { cancelled: boolean },
    opts: AnalyseOptions,
  ): Promise<PositionEval> {
    const w = this.ensureWorker()
    if (signal.cancelled) throw new Error('cancelled')
    this.byDepth = new Map()
    this.currentFen = fen
    this.currentSignal = signal
    const multiPv = Math.max(1, Math.min(5, opts.multiPv ?? 3))
    if (multiPv !== this.multiPV) {
      // the worker is idle here (searches are serialized), so options can change
      w.postMessage(`setoption name MultiPV value ${multiPv}`)
      this.multiPV = multiPv
    }
    let legal = multiPv
    try {
      legal = new Chess(fen).moves().length
    } catch {
      /* malformed FEN — let the engine report it */
    }
    this.expectedLines = Math.max(1, Math.min(multiPv, legal))
    this.onUpdate = opts.onUpdate
    const outcome = new Promise<SearchOutcome>((resolve, reject) => {
      this.searchResolve = resolve
      this.searchReject = reject
      // Stalled search: ask the engine to stop (its bestmove resolves us), then
      // fall back to the deepest completed depth if even that never arrives.
      setTimeout(() => {
        if (this.searchResolve !== resolve) return
        this.worker?.postMessage('stop')
        setTimeout(() => {
          if (this.searchResolve === resolve) {
            this.searchResolve = null
            this.searchReject = null
            resolve(buildEval(fen, this.byDepth, this.expectedLines))
          }
        }, 5000)
      }, 30000 + depth * 1500)
    })
    w.postMessage(`position fen ${fen}`)
    w.postMessage(opts.movetime ? `go depth ${depth} movetime ${Math.round(opts.movetime)}` : `go depth ${depth}`)
    try {
      const res = await outcome
      if (signal.cancelled) throw new Error('cancelled')
      const { bestUci: _drop, ...evalOnly } = res
      return evalOnly
    } finally {
      this.onUpdate = undefined
    }
  }

  private currentSignal: { cancelled: boolean } | null = null

  /**
   * End a running search early; it resolves with the deepest completed depth.
   * With a signal, only that caller's search is stopped (the engine is shared).
   */
  stop(signal?: { cancelled: boolean }): void {
    if (signal && signal !== this.currentSignal) return
    if (this.searchResolve) this.worker?.postMessage('stop')
  }

  cancel(): void {
    this.worker?.terminate()
    this.worker = null
    this.ready = null
    this.multiPV = 0
    this.searchResolve = null
    this.searchReject?.(new Error('cancelled'))
    this.searchReject = null
    this.initReject?.(new Error('cancelled'))
    this.initReject = null
    this.initResolve = null
  }

  destroy(): void {
    this.cancel()
  }
}

export function positionToReview(index: number, fen: string, evalResult: PositionEval): PlyReview {
  return { index, fen, whiteCp: evalResult.whiteCp, mateIn: evalResult.mateIn, lines: evalResult.lines, bestUci: evalResult.lines[0]?.uciFirst ?? '' }
}

/**
 * Several engines of one kind for batch work (reviews). Member 0 is also the
 * app's main engine for single-position work (analysis board, threats, drills),
 * so a pool of n costs n - 1 extra workers, created on first batch use.
 */
export class EnginePool {
  readonly choice: EngineChoice
  readonly clients: EngineClient[]

  /** The main engine gets the larger hash (it also serves the analysis board). */
  constructor(choice: EngineChoice, size = poolSize(), mainHashMb = 64, memberHashMb = 32) {
    this.choice = choice
    this.clients = [new EngineClient(choice, mainHashMb)]
    for (let i = 1; i < size; i++) this.clients.push(new EngineClient(choice, memberHashMb))
  }

  get main(): EngineClient {
    return this.clients[0]
  }

  init(): Promise<void> {
    return Promise.all(this.clients.map((c) => c.init())).then(() => undefined)
  }

  /** Stop a caller's searches on every member. */
  stop(signal?: { cancelled: boolean }): void {
    for (const c of this.clients) c.stop(signal)
  }

  destroy(): void {
    for (const c of this.clients) c.destroy()
  }
}
