import { useCallback, useEffect, useRef, useState } from 'react'
import { Chess, type Move } from 'chess.js'
import type { EngineChoice, EngineClient } from '../engine/engineClient'
import { reviewGame } from '../analysis/review'
import { buildSummary } from '../library/summary'
import { evalCache } from '../library/db'
import type { Library } from './useLibrary'

export interface ReviewQueue {
  pending: string[]
  current: string | null
  progress: { done: number; total: number }
  enqueue: (ids: string[]) => void
  cancel: () => void
}

interface Deps {
  library: Library
  engineChoice: EngineChoice
  depth: number
  getPool: (choice: EngineChoice) => EngineClient[]
  /** The foreground needs the engine (a review or live analysis is running). */
  paused: boolean
}

/**
 * Background batch review. Games are reviewed one at a time on the shared
 * engine; when the foreground needs it, the running game is abandoned after
 * its current position and retried later.
 */
export function useReviewQueue({ library, engineChoice, depth, getPool, paused }: Deps): ReviewQueue {
  const [pending, setPending] = useState<string[]>([])
  const [current, setCurrent] = useState<string | null>(null)
  const [progress, setProgress] = useState({ done: 0, total: 1 })
  const signalRef = useRef<{ cancelled: boolean } | null>(null)
  /** Set by cancel(): the abandoned game is dropped instead of retried. */
  const userCancelled = useRef(false)
  const libraryRef = useRef(library)
  useEffect(() => {
    libraryRef.current = library
  }, [library])

  const enqueue = useCallback((ids: string[]) => {
    setPending((p) => [...p, ...ids.filter((id) => !p.includes(id))])
  }, [])

  const cancel = useCallback(() => {
    if (signalRef.current) {
      userCancelled.current = true
      signalRef.current.cancelled = true
    }
    setPending([])
  }, [])

  // yield the engine to the foreground (cut the running position short too)
  useEffect(() => {
    if (!paused || !signalRef.current) return
    signalRef.current.cancelled = true
    for (const e of getPool(engineChoice)) e.stop(signalRef.current)
  }, [paused, getPool, engineChoice])

  useEffect(() => {
    if (paused || current || pending.length === 0) return
    const id = pending[0]
    const game = libraryRef.current.byId.get(id)
    setPending((p) => p.slice(1))
    if (!game || game.summary) return
    let moves: Move[]
    try {
      const c = new Chess()
      c.loadPgn(game.pgn)
      moves = c.history({ verbose: true })
    } catch {
      return
    }
    if (moves.length === 0) return
    const signal = { cancelled: false }
    signalRef.current = signal
    setCurrent(id)
    setProgress({ done: 0, total: moves.length + 1 })
    void (async () => {
      try {
        const engines = getPool(engineChoice)
        const result = await reviewGame(moves, engines, {
          depth,
          signal,
          cache: evalCache,
          cacheTag: engineChoice,
          context: { whiteElo: game.whiteElo, blackElo: game.blackElo, speed: game.speed },
          onProgress: (done, total) => setProgress({ done, total }),
        })
        if (signal.cancelled) throw new Error('cancelled')
        const summary = buildSummary(result, { gameId: id, pgn: game.pgn, timeControl: game.timeControl, engine: engineChoice })
        await libraryRef.current.saveReview(id, result, summary)
      } catch {
        // paused (not user-cancelled): retry this game first once the engine is free
        if (signal.cancelled && !userCancelled.current) setPending((p) => [id, ...p])
      } finally {
        userCancelled.current = false
        if (signalRef.current === signal) signalRef.current = null
        setCurrent(null)
      }
    })()
  }, [paused, current, pending, depth, engineChoice, getPool])

  return { pending, current, progress, enqueue, cancel }
}
