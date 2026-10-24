import { Chess } from 'chess.js'
import type { EngineLine, PlyReview } from '../types'

export interface PositionEval {
  whiteCp: number
  mateIn?: number
  lines: EngineLine[]
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
  return { whiteCp, mateIn, lines, bestUci: lines[0]?.uciFirst ?? '' }
}

export type EngineChoice = 'sf19-full' | 'sf19-lite' | 'sf16'

export const ENGINE_FILES: Record<EngineChoice, string> = {
  'sf19-full': 'stockfish-19-single.js',
  'sf19-lite': 'stockfish-19-lite-single.js',
  sf16: 'stockfish-nnue-16-single.js',
}

export const ENGINE_LABELS: Record<EngineChoice, string> = {
  'sf19-full': 'Stockfish 19 (full)',
  'sf19-lite': 'Stockfish 19 Lite',
  sf16: 'Stockfish 16',
}

export class EngineClient {
  private worker: Worker | null = null
  private initResolve: (() => void) | null = null
  private searchResolve: ((outcome: SearchOutcome) => void) | null = null
  private searchReject: ((err: Error) => void) | null = null
  private byDepth = new Map<number, Map<number, RawLine>>()
  private currentFen = ''
  readonly choice: EngineChoice

  constructor(choice: EngineChoice = 'sf19-full') {
    this.choice = choice
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker
    const w = new Worker(`/engines/${ENGINE_FILES[this.choice]}`)
    this.worker = w
    w.onmessage = (e: MessageEvent<string>) => this.onMessage(String(e.data))
    w.onerror = (e) => {
      const err = new Error(`Engine worker error: ${e.message || 'unknown'}`)
      this.searchReject?.(err)
      this.searchReject = null
      this.initResolve?.()
      this.initResolve = null
    }
    return w
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
      }
      return
    }
    if (text.startsWith('bestmove')) {
      const best = text.split(/\s+/)[1] ?? ''
      const outcome = buildEval(this.currentFen, this.byDepth, this.multiPV)
      outcome.bestUci = best
      this.searchResolve?.(outcome)
      this.searchResolve = null
      this.searchReject = null
      return
    }
    if (text === 'uciok' || text === 'readyok') {
      this.initResolve?.()
      this.initResolve = null
    }
  }

  private multiPV = 3

  async init(): Promise<void> {
    const w = this.ensureWorker()
    const done = new Promise<void>((resolve) => {
      this.initResolve = resolve
    })
    w.postMessage('uci')
    await done
    w.postMessage('setoption name MultiPV value 3')
    w.postMessage('setoption name Hash value 128')
    // SF16 needs NNUE enabled explicitly; SF19 removed the option (NNUE-only).
    if (this.choice === 'sf16') w.postMessage('setoption name Use NNUE value true')
    w.postMessage('isready')
    const ready = new Promise<void>((resolve) => {
      this.initResolve = resolve
    })
    await ready
  }

  async analyse(fen: string, depth: number, signal: { cancelled: boolean }): Promise<PositionEval> {
    // Serialize: interleaved UCI searches on one worker corrupt each other.
    const run = () => this.runAnalyse(fen, depth, signal)
    const result = this.taskQueue.then(run, run)
    this.taskQueue = result.catch(() => undefined)
    return result
  }

  private taskQueue: Promise<unknown> = Promise.resolve()

  private async runAnalyse(fen: string, depth: number, signal: { cancelled: boolean }): Promise<PositionEval> {
    const w = this.ensureWorker()
    if (signal.cancelled) throw new Error('cancelled')
    this.byDepth = new Map()
    this.currentFen = fen
    const outcome = new Promise<SearchOutcome>((resolve, reject) => {
      this.searchResolve = resolve
      this.searchReject = reject
      setTimeout(() => {
        if (this.searchResolve === resolve) {
          this.searchResolve = null
          this.searchReject = null
          resolve(buildEval(fen, this.byDepth, this.multiPV))
        }
      }, 30000 + depth * 1500)
    })
    w.postMessage(`position fen ${fen}`)
    w.postMessage(`go depth ${depth}`)
    const res = await outcome
    if (signal.cancelled) throw new Error('cancelled')
    const { bestUci: _drop, ...evalOnly } = res
    return evalOnly
  }

  cancel(): void {
    this.worker?.terminate()
    this.worker = null
    this.searchResolve = null
    this.searchReject?.(new Error('cancelled'))
    this.searchReject = null
  }

  destroy(): void {
    this.cancel()
  }
}

export function positionToReview(index: number, fen: string, evalResult: PositionEval): PlyReview {
  return { index, fen, whiteCp: evalResult.whiteCp, mateIn: evalResult.mateIn, lines: evalResult.lines, bestUci: evalResult.lines[0]?.uciFirst ?? '' }
}
