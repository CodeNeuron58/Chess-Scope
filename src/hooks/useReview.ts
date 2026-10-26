import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Move, ReviewResult } from '../types'
import type { EngineChoice } from '../engine/engineClient'
import type { EngineClient } from '../engine/engineClient'
import { reviewGame } from '../analysis/review'

export interface ReviewState {
  /** The review of the current moves, or null (a changed game invalidates it). */
  review: ReviewResult | null
  reviewing: boolean
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
  getEngine: (choice: EngineChoice) => EngineClient
  destroyEngine: () => void
  onComplete?: (result: ReviewResult) => void
}

export function movesKey(moves: Pick<Move, 'lan'>[]): string {
  return moves.map((m) => m.lan).join(',')
}

/** Review orchestration: runs the per-position analysis pipeline with progress + cancel. */
export function useReview(deps: Deps): ReviewState {
  const { moves, depth, engineChoice, getEngine, destroyEngine, onComplete } = deps
  const [stored, setStored] = useState<{ key: string; result: ReviewResult } | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [loadingEngine, setLoadingEngine] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 1 })
  const [engineStatus, setEngineStatus] = useState('')
  const cancelRef = useRef({ cancelled: false })
  const autoReviewPending = useRef(false)
  const onCompleteRef = useRef(onComplete)
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  const key = useMemo(() => movesKey(moves), [moves])
  const review = stored && stored.key === key ? stored.result : null

  const startReview = useCallback(async () => {
    if (moves.length === 0 || reviewing) return
    const signal = { cancelled: false }
    cancelRef.current = signal
    const reviewKey = movesKey(moves)
    setReviewing(true)
    setLoadingEngine(true)
    setProgress({ done: 0, total: moves.length + 1 })
    setEngineStatus('')
    const engine = getEngine(engineChoice)
    try {
      await engine.init()
      if (signal.cancelled) return
      setLoadingEngine(false)
      const result = await reviewGame(moves, engine, {
        depth,
        onProgress: (done, total) => setProgress({ done, total }),
        signal,
      })
      if (signal.cancelled) return
      setStored({ key: reviewKey, result })
      onCompleteRef.current?.(result)
    } catch (e) {
      if (!signal.cancelled) {
        setEngineStatus(`Engine error: ${e instanceof Error ? e.message : String(e)}`)
      }
    } finally {
      if (signal.cancelled) destroyEngine()
      setReviewing(false)
      setLoadingEngine(false)
    }
  }, [moves, reviewing, depth, engineChoice, getEngine, destroyEngine])

  const cancelReview = useCallback(() => {
    cancelRef.current.cancelled = true
    destroyEngine()
    setReviewing(false)
    setLoadingEngine(false)
    setEngineStatus('')
  }, [destroyEngine])

  const adoptReview = useCallback((result: ReviewResult) => {
    setStored({ key: movesKey(result.moves.map((m) => m.move)), result })
  }, [])

  const markAutoReview = useCallback(() => {
    autoReviewPending.current = true
  }, [])

  // auto-start the review after a game loads with the "review" intent
  useEffect(() => {
    if (autoReviewPending.current && moves.length > 0 && !reviewing) {
      autoReviewPending.current = false
      if (!review) void startReview()
    }
  }, [moves, reviewing, review, startReview])

  return {
    review,
    reviewing,
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
