import { useCallback, useEffect, useRef, useState } from 'react'
import type { Move, ReviewResult } from '../types'
import type { EngineChoice } from '../engine/engineClient'
import type { EngineClient } from '../engine/engineClient'
import { reviewGame } from '../analysis/review'

export interface ReviewState {
  review: ReviewResult | null
  reviewing: boolean
  progress: { done: number; total: number }
  engineStatus: string
  setEngineStatus: (s: string) => void
  startReview: () => Promise<void>
  cancelReview: () => void
  /** Load a game then automatically start its review (chess.com one-click flow). */
  markAutoReview: () => void
}

interface Deps {
  moves: Move[]
  depth: number
  engineChoice: EngineChoice
  getEngine: (choice: EngineChoice) => EngineClient
  destroyEngine: () => void
}

/** Review orchestration: runs the per-position analysis pipeline with progress + cancel. */
export function useReview(deps: Deps): ReviewState {
  const { moves, depth, engineChoice, getEngine, destroyEngine } = deps
  const [review, setReview] = useState<ReviewResult | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 1 })
  const [engineStatus, setEngineStatus] = useState('')
  const cancelRef = useRef({ cancelled: false })
  const autoReviewPending = useRef(false)

  // a modified game invalidates any stored review
  const movesKey = useRef('')
  useEffect(() => {
    const key = moves.map((m) => m.lan).join(',')
    if (movesKey.current && movesKey.current !== key) setReview(null)
    movesKey.current = key
  }, [moves])

  const startReview = useCallback(async () => {
    if (moves.length === 0 || reviewing) return
    const signal = { cancelled: false }
    cancelRef.current = signal
    setReviewing(true)
    setProgress({ done: 0, total: moves.length + 1 })
    setReview(null)
    const engine = getEngine(engineChoice)
    try {
      setEngineStatus('Loading engine…')
      await engine.init()
      if (signal.cancelled) return
      setEngineStatus('')
      const result = await reviewGame(moves, engine, {
        depth,
        onProgress: (done, total) => setProgress({ done, total }),
        signal,
      })
      if (signal.cancelled) return
      setReview(result)
    } catch (e) {
      if (!signal.cancelled) {
        setEngineStatus(`Engine error: ${e instanceof Error ? e.message : String(e)}`)
      }
    } finally {
      if (signal.cancelled) destroyEngine()
      setReviewing(false)
    }
  }, [moves, reviewing, depth, engineChoice, getEngine, destroyEngine])

  const cancelReview = useCallback(() => {
    cancelRef.current.cancelled = true
    destroyEngine()
    setReviewing(false)
    setEngineStatus('')
  }, [destroyEngine])

  const markAutoReview = useCallback(() => {
    autoReviewPending.current = true
  }, [])

  // auto-start the review after a chess.com game loads
  useEffect(() => {
    if (autoReviewPending.current && moves.length > 0 && !reviewing) {
      autoReviewPending.current = false
      void startReview()
    }
  }, [moves, reviewing, startReview])

  return { review, reviewing, progress, engineStatus, setEngineStatus, startReview, cancelReview, markAutoReview }
}
