import { useCallback, useEffect, useState } from 'react'
import type { EngineChoice } from '../engine/engineClient'

const PREFIX = 'chessscope.'

// One-time settings migration: v1 defaults (SF19 Lite + depth 10) produce
// significantly inflated accuracy — v2 resets engine/depth to Full/14.
try {
  if (Number(localStorage.getItem(`${PREFIX}settingsV`) ?? '0') < 2) {
    localStorage.removeItem(`${PREFIX}engineChoice`)
    localStorage.removeItem(`${PREFIX}depth`)
    localStorage.setItem(`${PREFIX}settingsV`, '2')
  }
} catch {
  /* storage unavailable */
}

/** useState that transparently persists to localStorage. */
export function usePersistedState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(PREFIX + key)
      return raw === null ? fallback : (JSON.parse(raw) as T)
    } catch {
      return fallback
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value))
    } catch {
      /* storage unavailable */
    }
  }, [key, value])
  return [value, setValue] as const
}

export interface Settings {
  depth: number
  setDepth: React.Dispatch<React.SetStateAction<number>>
  orientation: 'white' | 'black'
  toggleOrientation: () => void
  audioOn: boolean
  setAudioOn: React.Dispatch<React.SetStateAction<boolean>>
  engineChoice: EngineChoice
  setEngineChoice: React.Dispatch<React.SetStateAction<EngineChoice>>
}

export function useSettings(): Settings {
  const [depth, setDepth] = usePersistedState('depth', 14)
  const [orientation, setOrientation] = usePersistedState<'white' | 'black'>('orientation', 'white')
  const [audioOn, setAudioOn] = usePersistedState('audioOn', false)
  const [engineChoice, setEngineChoice] = usePersistedState<EngineChoice>('engineChoice', 'sf19-full')
  const toggleOrientation = useCallback(() => {
    setOrientation((o) => (o === 'white' ? 'black' : 'white'))
  }, [setOrientation])
  return { depth, setDepth, orientation, toggleOrientation, audioOn, setAudioOn, engineChoice, setEngineChoice }
}
