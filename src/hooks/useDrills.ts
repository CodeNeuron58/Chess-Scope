import { useCallback, useMemo, useState } from 'react'
import { Chess, type Square } from 'chess.js'
import type { ReviewResult } from '../types'
import { MISTAKE_CLASSES } from '../lib/constants'
import type { EngineChoice } from '../engine/engineClient'
import type { EngineClient } from '../engine/engineClient'
import { moveAccuracy, winFor } from '../analysis/accuracy'

const DRILL_SOLVE_ACCURACY = 96

export interface DrillState {
  side: 'w' | 'b'
  list: { ply: number; classification: string }[]
  idx: number
  phase: 'attempt' | 'solved' | 'revealed'
  feedback: string | null
  hints: number
  foundNoHint: number
}

interface Deps {
  review: ReviewResult | null
  engineChoice: EngineChoice
  whiteAtBottom: boolean
  getEngine: (choice: EngineChoice) => EngineClient
  setPly: (p: number) => void
  onExit: () => void
}

export interface DrillController {
  /** True when the side-picker is showing (drills active, no side chosen). */
  intro: boolean
  /** Active drill state, or null when showing the intro. */
  panel: DrillState | null
  boardFen: string | null
  hintArrow: [Square, Square] | null
  hintSquares: string[]
  selection: string | null
  counts: { white: number; black: number }
  onBoardClick: (clientX: number, clientY: number) => void
  hint: () => void
  showSolution: () => void
  next: () => void
  exit: () => void
  start: (side: 'w' | 'b') => void
}

/** Mistake drills: replay each reviewed error with the played move hidden. */
export function useDrills({ review, engineChoice, whiteAtBottom, getEngine, setPly, onExit }: Deps): DrillController {
  const [drill, setDrill] = useState<DrillState | null>(null)
  const [boardFen, setBoardFen] = useState<string | null>(null)
  const [hintArrow, setHintArrow] = useState<[Square, Square] | null>(null)
  const [hintSquares, setHintSquares] = useState<string[]>([])
  const [selection, setSelection] = useState<string | null>(null)

  const counts = useMemo(() => {
    const c = { white: 0, black: 0 }
    if (!review) return c
    for (const m of review.moves) {
      if (MISTAKE_CLASSES.includes(m.classification)) {
        c[m.move.color === 'w' ? 'white' : 'black']++
      }
    }
    return c
  }, [review])

  const exit = useCallback(() => {
    setDrill(null)
    setBoardFen(null)
    setHintSquares([])
    setHintArrow(null)
    setSelection(null)
    onExit()
  }, [onExit])

  const start = useCallback(
    (side: 'w' | 'b') => {
      if (!review) return
      const list = review.moves
        .filter((m) => m.move.color === side && MISTAKE_CLASSES.includes(m.classification))
        .map((m) => ({ ply: m.ply, classification: m.classification }))
      if (list.length === 0) return
      setPly(list[0].ply - 1)
      setBoardFen(review.positions[list[0].ply - 1].fen)
      setHintSquares([])
      setHintArrow(null)
      setSelection(null)
      setDrill({ side, list, idx: 0, phase: 'attempt', feedback: null, hints: 0, foundNoHint: 0 })
    },
    [review],
  )

  const hint = useCallback(() => {
    if (!drill || drill.phase !== 'attempt' || !review) return
    const best = review.positions[drill.list[drill.idx].ply - 1].bestUci
    if (!best) return
    const next = Math.min(3, drill.hints + 1)
    if (next === 1) setHintSquares([best.slice(0, 2)])
    else if (next === 2) setHintSquares([best.slice(0, 2), best.slice(2, 4)])
    else {
      setHintSquares([best.slice(0, 2), best.slice(2, 4)])
      setHintArrow([best.slice(0, 2) as Square, best.slice(2, 4) as Square])
    }
    setDrill({ ...drill, hints: next })
  }, [drill, review])

  const showSolution = useCallback(() => {
    if (!drill || !review) return
    const best = review.positions[drill.list[drill.idx].ply - 1].bestUci
    if (best) {
      setHintSquares([best.slice(0, 2), best.slice(2, 4)])
      setHintArrow([best.slice(0, 2) as Square, best.slice(2, 4) as Square])
    }
    setDrill({ ...drill, phase: 'revealed' })
  }, [drill, review])

  const next = useCallback(() => {
    if (!drill || !review) return
    if (drill.idx >= drill.list.length - 1) {
      exit()
      return
    }
    const nextIdx = drill.idx + 1
    const nextPly = drill.list[nextIdx].ply
    setDrill({ ...drill, idx: nextIdx, phase: 'attempt', feedback: null, hints: 0 })
    setPly(nextPly - 1)
    setBoardFen(review.positions[nextPly - 1].fen)
    setHintSquares([])
    setHintArrow(null)
    setSelection(null)
  }, [drill, review, exit])

  const tryMove = useCallback(
    async (from: Square, to: Square, piece: string) => {
      if (!drill || drill.phase !== 'attempt' || !review) return
      const before = review.positions[drill.list[drill.idx].ply - 1]
      const board = new Chess(before.fen)
      const source = board.get(from)
      let promotion: string | undefined
      if (source?.type === 'p' && (to[1] === '8' || to[1] === '1')) {
        const kind = piece[1]?.toLowerCase()
        promotion = kind && kind !== 'p' && 'qrbn'.includes(kind) ? kind : 'q'
      }
      let lan: string
      let after: string
      let san: string
      try {
        const attempt = board.move({ from, to, promotion })
        lan = attempt.lan
        after = attempt.after
        san = attempt.san
      } catch {
        return
      }
      const engine = getEngine(engineChoice)
      setDrill({ ...drill, feedback: 'Checking your move…' })
      try {
        await engine.init()
        const res = await engine.analyse(after, 10, { cancelled: false })
        const winBefore = winFor(before.whiteCp, drill.side)
        const winAfter = winFor(res.whiteCp, drill.side)
        const acc = moveAccuracy(winBefore, winAfter)
        if (acc >= DRILL_SOLVE_ACCURACY) {
          setDrill({
            ...drill,
            phase: 'solved',
            foundNoHint: drill.foundNoHint + (drill.hints === 0 ? 1 : 0),
            feedback: `You played ${san} — as good as the engine's choice (${acc.toFixed(1)}% on the move).`,
          })
          setBoardFen(after)
          setHintSquares([])
          setHintArrow([lan.slice(0, 2) as Square, lan.slice(2, 4) as Square])
        } else {
          const drop = Math.max(0, winBefore - winAfter).toFixed(1)
          setDrill({
            ...drill,
            feedback: `${san} gives up about ${drop}% winning chances — keep looking.`,
          })
        }
      } catch {
        setDrill({ ...drill, feedback: 'Engine check failed — try again.' })
      }
    },
    [drill, review, engineChoice, getEngine],
  )

  // Click-to-move: click a piece, then a target square.
  const onBoardClick = useCallback(
    (clientX: number, clientY: number) => {
      if (!drill || drill.phase !== 'attempt') return
      const wrap = document.querySelector('.board-wrap')
      if (!wrap) return
      const rect = wrap.getBoundingClientRect()
      const s = rect.width / 8
      const col = Math.floor((clientX - rect.x) / s)
      const row = Math.floor((clientY - rect.y) / s)
      if (col < 0 || col > 7 || row < 0 || row > 7) return
      const fileCh = 'abcdefgh'[whiteAtBottom ? col : 7 - col]
      const rankCh = whiteAtBottom ? String(8 - row) : String(row + 1)
      const square = `${fileCh}${rankCh}`
      setSelection((prev) => {
        if (!prev) return square
        if (prev === square) return null
        void tryMove(prev as Square, square as Square, 'q')
        return null
      })
    },
    [drill, tryMove, whiteAtBottom],
  )

  const intro = !!drill && drill.list.length === 0

  return {
    intro,
    panel: drill && drill.list.length > 0 ? drill : null,
    boardFen: drill ? boardFen : null,
    hintArrow,
    hintSquares,
    selection,
    counts,
    onBoardClick,
    hint,
    showSolution,
    next,
    exit,
    start,
  }
}
