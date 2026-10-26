import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Move, ReviewContext, ReviewResult } from '../types'
import type { EngineChoice } from '../engine/engineClient'
import type { EngineClient } from '../engine/engineClient'
import { reviewGame } from '../analysis/review'
import { evalCache } from '../library/db'

/** Depth of the quick first pass; the report shows after it while the full pass refines. */
export const QUICK_DEPTH = 8

export interface ReviewState {
  /** The review of the current moves, or null (a changed game invalidates it). */
  review: ReviewResult | null
  /** The first pass is running (board overlay). */
  reviewing: boolean
  /** The quick report is shown and the full-depth pass is still running. */
  refining: boolean
  progress: { done: number; total: number }
  /** True while the engine is still loading, before the first position. */
  loadingEngine: boolean
  engineStatus: string
  setEngineStatus: (s: string) => void
  startReview: () => Promise<void>
  cancelReview: () => void
  /** Restore a stored review for the current moves (no re-analysis). */
  adoptReview: (result: ReviewResult) => void
  /** Load a game, then start its review once the moves are in place. */
  markAutoReview: () => void
}

interface Deps {
  moves: Move[]
  depth: number
  engineChoice: EngineChoice
  context: ReviewContext
  /** The engines to review with, analysing positions side by side. */
  getPool: (choice: EngineChoice) => EngineClient[]
  /** Fast-loading engines for the quick first pass. */
  getQuickPool: (choice: EngineChoice) => EngineClient[]
  destroyEngine: () => void
  onComplete?: (result: ReviewResult) => void
}

export function movesKey(moves: Pick<Move, 'lan'>[]): string {
  return moves.map((m) => m.lan).join(',')
}

/**
 * Review orchestration. Two passes: a quick shallow pass puts the full report
 * on screen in seconds, then the selected depth refines it in place. Engine
 * results are cached per position, so re-runs and repeated positions are free.
 */
export function useReview(deps: Deps): ReviewState {
  const { moves, depth, engineChoice, context, getPool, getQuickPool, destroyEngine, onComplete } = deps
  const [stored, setStored] = useState<{ key: string; result: ReviewResult } | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [refining, setRefining] = useState(false)
  const [loadingEngine, setLoadingEngine] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 1 })
  const [engineStatus, setEngineStatus] = useState('')
  const cancelRef = useRef({ cancelled: false })
  const enginesRef = useRef<EngineClient[]>([])
  const activeKey = useRef('')
  const autoReviewPending = useRef(false)
  const onCompleteRef = useRef(onComplete)
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  const key = useMemo(() => movesKey(moves), [moves])
  const review = stored && stored.key === key ? stored.result : null
  const busy = reviewing || refining

  const startReview = useCallback(async () => {
    if (moves.length === 0 || busy) return
    const signal = { cancelled: false }
    cancelRef.current = signal
    const reviewKey = movesKey(moves)
    activeKey.current = reviewKey
    setReviewing(true)
    setLoadingEngine(true)
    setProgress({ done: 0, total: moves.length + 1 })
    setEngineStatus('')
    const engines = getPool(engineChoice)
    const quickEngines = depth > QUICK_DEPTH ? getQuickPool(engineChoice) : engines
    enginesRef.current = [...new Set([...engines, ...quickEngines])]
    const base = {
      signal,
      cache: evalCache,
      context,
      onProgress: (done: number, total: number) => setProgress({ done, total }),
    }
    try {
      // the full engines start loading now and join the refine pass when ready
      for (const e of engines) void e.init().catch(() => undefined)
      await quickEngines[0].init()
      if (signal.cancelled) return
      setLoadingEngine(false)
      if (depth > QUICK_DEPTH) {
        const quick = await reviewGame(moves, quickEngines, { ...base, cacheTag: quickEngines[0].choice, depth: QUICK_DEPTH })
        if (signal.cancelled) return
        setStored({ key: reviewKey, result: { ...quick, preliminary: true } })
        setReviewing(false)
        setRefining(true)
        setProgress({ done: 0, total: moves.length + 1 })
      }
      const result = await reviewGame(moves, engines, { ...base, cacheTag: engineChoice, depth })
      if (signal.cancelled) return
      setStored({ key: reviewKey, result })
      // only save when the board still shows the game that was reviewed
      if (activeKey.current === reviewKey) onCompleteRef.current?.(result)
    } catch (e) {
      if (!signal.cancelled) {
        setEngineStatus(`Engine error: ${e instanceof Error ? e.message : String(e)}`)
      }
    } finally {
      // a newer run owns the state once it has started
      if (cancelRef.current === signal) {
        setReviewing(false)
        setRefining(false)
        setLoadingEngine(false)
      }
    }
  }, [moves, busy, depth, engineChoice, context, getPool, getQuickPool])

  const cancelReview = useCallback(() => {
    cancelRef.current.cancelled = true
    destroyEngine()
    setReviewing(false)
    setRefining(false)
    setLoadingEngine(false)
    setEngineStatus('')
  }, [destroyEngine])

  // a different game on the board ends any review still running for the old one
  // (stopping its search keeps the shared engine alive for whatever comes next)
  useEffect(() => {
    if (activeKey.current && activeKey.current !== key && !cancelRef.current.cancelled) {
      activeKey.current = ''
      cancelRef.current.cancelled = true
      for (const e of enginesRef.current) e.stop(cancelRef.current)
    }
  }, [key])

  const adoptReview = useCallback((result: ReviewResult) => {
    setStored({ key: movesKey(result.moves.map((m) => m.move)), result })
  }, [])

  const markAutoReview = useCallback(() => {
    autoReviewPending.current = true
  }, [])

  // auto-start the review after a game loads with the "review" intent
  useEffect(() => {
    if (autoReviewPending.current && moves.length > 0 && !busy) {
      autoReviewPending.current = false
      if (!review) void startReview()
    }
  }, [moves, busy, review, startReview])

  return {
    review,
    reviewing,
    refining,
    progress,
    loadingEngine,
    engineStatus,
    setEngineStatus,
    startReview,
    cancelReview,
    adoptReview,
    markAutoReview,
  }
}
