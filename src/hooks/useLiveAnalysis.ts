import { useEffect, useState } from 'react'
import type { EngineChoice, EngineClient, PositionEval } from '../engine/engineClient'
import { LIVE_MAX_DEPTH } from '../lib/constants'

export interface LiveAnalysis {
  /** Latest result for the current position, or null while starting / when off. */
  result: PositionEval | null
  depth: number
  running: boolean
  error: string
}

interface Deps {
  fen: string
  enabled: boolean
  engineChoice: EngineChoice
  getEngine: (choice: EngineChoice) => EngineClient
  maxDepth?: number
}

const IDLE: LiveAnalysis = { result: null, depth: 0, running: false, error: '' }

/** Analysis-board engine: searches the shown position, deepening until maxDepth. */
export function useLiveAnalysis({ fen, enabled, engineChoice, getEngine, maxDepth = LIVE_MAX_DEPTH }: Deps): LiveAnalysis {
  const [state, setState] = useState<LiveAnalysis & { fen: string }>({ ...IDLE, fen })

  useEffect(() => {
    if (!enabled) {
      setState({ ...IDLE, fen })
      return
    }
    const signal = { cancelled: false }
    const engine = getEngine(engineChoice)
    setState({ ...IDLE, running: true, fen })
    void (async () => {
      try {
        await engine.init()
        if (signal.cancelled) return
        const res = await engine.analyse(fen, maxDepth, signal, {
          onUpdate: (u) => {
            if (!signal.cancelled) setState({ result: u, depth: u.depth ?? 0, running: true, error: '', fen })
          },
        })
        if (!signal.cancelled) setState({ result: res, depth: res.depth ?? maxDepth, running: false, error: '', fen })
      } catch (e) {
        if (!signal.cancelled) {
          setState({ ...IDLE, error: e instanceof Error ? e.message : String(e), fen })
        }
      }
    })()
    return () => {
      signal.cancelled = true
      engine.stop(signal)
    }
  }, [fen, enabled, engineChoice, getEngine, maxDepth])

  // never show a result computed for a different position
  return state.fen === fen ? state : { ...IDLE, running: enabled }
}
