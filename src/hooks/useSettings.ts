import { useCallback, useEffect, useMemo, useState } from 'react'
import type { EngineChoice } from '../engine/engineClient'
import type { BoardThemeKey, PieceSetKey } from '../lib/constants'
import type { Accounts } from '../library/types'

const PREFIX = 'owlchess.'
const LEGACY = 'chessscope.'

// One-time migration from the ChessScope era. Legacy v1 defaults (SF19 Lite +
// depth 10) inflated accuracy, so engine/depth only carry over from v2 installs.
try {
  if (localStorage.getItem(`${PREFIX}settingsV`) === null) {
    const legacyV = Number(localStorage.getItem(`${LEGACY}settingsV`) ?? '0')
    const carry = ['orientation', 'audioOn', ...(legacyV >= 2 ? ['engineChoice', 'depth'] : [])]
    for (const key of carry) {
      const v = localStorage.getItem(LEGACY + key)
      if (v !== null) localStorage.setItem(PREFIX + key, v)
    }
    const ccUser = localStorage.getItem(`${LEGACY}ccUser`)
    const ccProxy = localStorage.getItem(`${LEGACY}ccProxy`)
    if (ccUser || ccProxy) {
      const accounts: Accounts = { chesscom: ccUser ?? '', lichess: '', lichessToken: '', chesscomProxy: ccProxy ?? '' }
      localStorage.setItem(`${PREFIX}accounts`, JSON.stringify(accounts))
    }
    localStorage.setItem(`${PREFIX}settingsV`, '3')
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

export type ExplainLevel = 'brief' | 'balanced' | 'detailed'
export type LineCount = 1 | 2 | 3

type Setter<T> = React.Dispatch<React.SetStateAction<T>>

export interface Settings {
  depth: number
  setDepth: Setter<number>
  engineChoice: EngineChoice
  setEngineChoice: Setter<EngineChoice>
  lines: LineCount
  setLines: Setter<LineCount>
  orientation: 'white' | 'black'
  toggleOrientation: () => void
  setOrientation: Setter<'white' | 'black'>
  boardTheme: BoardThemeKey
  setBoardTheme: Setter<BoardThemeKey>
  pieceSet: PieceSetKey
  setPieceSet: Setter<PieceSetKey>
  coords: boolean
  setCoords: Setter<boolean>
  animate: boolean
  setAnimate: Setter<boolean>
  sounds: boolean
  setSounds: Setter<boolean>
  /** Coach voice (Web Speech API). */
  audioOn: boolean
  setAudioOn: Setter<boolean>
  autoAdvance: boolean
  setAutoAdvance: Setter<boolean>
  explainLevel: ExplainLevel
  setExplainLevel: Setter<ExplainLevel>
  autoReview: boolean
  setAutoReview: Setter<boolean>
  keyboard: boolean
  setKeyboard: Setter<boolean>
  accounts: Accounts
  setAccounts: Setter<Accounts>
}

const NO_ACCOUNTS: Accounts = { chesscom: '', lichess: '', lichessToken: '', chesscomProxy: '' }

export function useSettings(): Settings {
  const [depth, setDepth] = usePersistedState('depth', 14)
  const [engineChoice, setEngineChoice] = usePersistedState<EngineChoice>('engineChoice', 'sf19-full')
  const [lines, setLines] = usePersistedState<LineCount>('lines', 3)
  const [orientation, setOrientation] = usePersistedState<'white' | 'black'>('orientation', 'white')
  const [boardTheme, setBoardTheme] = usePersistedState<BoardThemeKey>('boardTheme', 'forest')
  const [pieceSet, setPieceSet] = usePersistedState<PieceSetKey>('pieceSet', 'cburnett')
  const [coords, setCoords] = usePersistedState('coords', true)
  const [animate, setAnimate] = usePersistedState('animate', true)
  const [sounds, setSounds] = usePersistedState('sounds', false)
  const [audioOn, setAudioOn] = usePersistedState('audioOn', false)
  const [autoAdvance, setAutoAdvance] = usePersistedState('autoAdvance', true)
  const [explainLevel, setExplainLevel] = usePersistedState<ExplainLevel>('explainLevel', 'balanced')
  const [autoReview, setAutoReview] = usePersistedState('autoReview', true)
  const [keyboard, setKeyboard] = usePersistedState('keyboard', true)
  const [accounts, setAccounts] = usePersistedState<Accounts>('accounts', NO_ACCOUNTS)
  const mergedAccounts = useMemo(() => ({ ...NO_ACCOUNTS, ...accounts }), [accounts])
  const toggleOrientation = useCallback(() => {
    setOrientation((o) => (o === 'white' ? 'black' : 'white'))
  }, [setOrientation])
  return {
    depth,
    setDepth,
    engineChoice,
    setEngineChoice,
    lines,
    setLines,
    orientation,
    toggleOrientation,
    setOrientation,
    boardTheme,
    setBoardTheme,
    pieceSet,
    setPieceSet,
    coords,
    setCoords,
    animate,
    setAnimate,
    sounds,
    setSounds,
    audioOn,
    setAudioOn,
    autoAdvance,
    setAutoAdvance,
    explainLevel,
    setExplainLevel,
    autoReview,
    setAutoReview,
    keyboard,
    setKeyboard,
    accounts: mergedAccounts,
    setAccounts,
  }
}

/** Connected account names, for matching the user's side in games. */
export function accountNames(accounts: Accounts): string[] {
  return [accounts.chesscom, accounts.lichess].map((a) => a.trim()).filter(Boolean)
}
