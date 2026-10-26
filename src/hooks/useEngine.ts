import { useCallback, useRef } from 'react'
import { EnginePool, type EngineChoice, type EngineClient } from '../engine/engineClient'

/**
 * Owns the engines: one EnginePool per engine choice, recreated when the user
 * switches engines. `getEngine` is the pool's main engine (single positions);
 * `getPool` is the whole pool (reviews analyse positions side by side).
 */
export function useEngine() {
  const poolRef = useRef<EnginePool | null>(null)
  const quickRef = useRef<EnginePool | null>(null)

  const pool = useCallback((choice: EngineChoice): EnginePool => {
    if (poolRef.current?.choice !== choice) {
      poolRef.current?.destroy()
      poolRef.current = new EnginePool(choice)
    }
    return poolRef.current
  }, [])

  const getEngine = useCallback((choice: EngineChoice): EngineClient => pool(choice).main, [pool])
  const getPool = useCallback((choice: EngineChoice): EngineClient[] => pool(choice).clients, [pool])

  /**
   * Engines for the quick first pass: the 1.8 MB lite build loads in well under
   * a second, while the full build (~99 MB) takes seconds to compile — so the
   * preliminary report never waits for the big download.
   */
  const getQuickPool = useCallback(
    (choice: EngineChoice): EngineClient[] => {
      if (choice === 'sf19-lite') return pool(choice).clients
      // depth-8 searches need very little hash
      quickRef.current ??= new EnginePool('sf19-lite', undefined, 16, 16)
      return quickRef.current.clients
    },
    [pool],
  )

  const destroyEngine = useCallback(() => {
    poolRef.current?.destroy()
    poolRef.current = null
    quickRef.current?.destroy()
    quickRef.current = null
  }, [])

  return { getEngine, getPool, getQuickPool, destroyEngine }
}
