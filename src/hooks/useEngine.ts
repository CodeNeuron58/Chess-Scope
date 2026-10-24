import { useCallback, useRef } from 'react'
import { EngineClient, type EngineChoice } from '../engine/engineClient'

/**
 * Owns the engine client lifecycle: exactly one live EngineClient per
 * engine choice, recreated when the user switches engines.
 */
export function useEngine() {
  const engineRef = useRef<EngineClient | null>(null)
  const activeChoice = useRef<EngineChoice>('sf19-full')

  const getEngine = useCallback((choice: EngineChoice): EngineClient => {
    if (engineRef.current?.choice !== choice) {
      engineRef.current?.destroy()
      engineRef.current = new EngineClient(choice)
    }
    activeChoice.current = choice
    return engineRef.current
  }, [])

  const destroyEngine = useCallback(() => {
    engineRef.current?.destroy()
    engineRef.current = null
  }, [])

  return { getEngine, destroyEngine, hasEngineFor: (choice: EngineChoice) => engineRef.current?.choice === choice }
}
