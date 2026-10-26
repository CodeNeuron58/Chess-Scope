import { useCallback, useEffect, useState } from 'react'
import type { EngineLine } from '../types'
import { flipTurn } from '../lib/chessUtils'
import type { EngineChoice } from '../engine/engineClient'
import type { EngineClient } from '../engine/engineClient'

interface Deps {
  /** Engine is needed elsewhere (e.g. a review is running). */
  blocked: boolean
  displayedFen: string
  engineChoice: EngineChoice
  getEngine: (choice: EngineChoice) => EngineClient
}

/** Threat display: the opponent's best reply in the current position (X key). Searches only while shown. */
export function useThreats({ blocked, displayedFen, engineChoice, getEngine }: Deps) {
  const [threatOn, setThreatOn] = useState(false)
  const [threat, setThreat] = useState<EngineLine | null>(null)

  const toggleThreat = useCallback(() => setThreatOn((t) => !t), [])

  useEffect(() => {
    setThreat(null)
    if (!threatOn || blocked) return
    const flipped = flipTurn(displayedFen)
    if (!flipped) return
    const sig = { cancelled: false }
    const engine = getEngine(engineChoice)
    void (async () => {
      try {
        await engine.init()
        const res = await engine.analyse(flipped, 12, sig)
        if (!sig.cancelled) setThreat(res.lines[0] ?? null)
      } catch {
        if (!sig.cancelled) setThreat(null)
      }
    })()
    return () => {
      sig.cancelled = true
      engine.stop(sig)
    }
  }, [threatOn, blocked, displayedFen, engineChoice, getEngine])

  return { threatOn, toggleThreat, threat }
}
