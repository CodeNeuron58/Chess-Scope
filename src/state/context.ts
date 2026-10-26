import { createContext, useContext } from 'react'
import type { Page, Route } from '../router'
import type { GameState } from '../hooks/useGameState'
import type { Settings } from '../hooks/useSettings'
import type { ReviewState } from '../hooks/useReview'
import type { Library } from '../hooks/useLibrary'
import type { ReviewQueue } from '../hooks/useReviewQueue'
import type { EngineChoice, EngineClient } from '../engine/engineClient'
import type { GameSource, StoredGame } from '../library/types'

export type ReviewTab = 'summary' | 'moves'

export interface OpenOptions {
  /** Ply to show (defaults to the start; 'last' resumes where the user left off). */
  at?: number | 'last'
  page?: Extract<Page, 'review' | 'analysis'>
  tab?: ReviewTab
  /** Start a review right away when the game has none. */
  review?: boolean
}

export interface AppState {
  route: Route
  navigate: (page: Page, params?: Record<string, string>, section?: string) => void
  settings: Settings
  /** Connected account names (the user's identities in games). */
  names: string[]
  game: GameState
  getEngine: (choice: EngineChoice) => EngineClient
  review: ReviewState
  library: Library
  queue: ReviewQueue
  /** The library record of the game on the board, while its moves are unchanged. */
  currentGame: StoredGame | null
  openGame: (id: string, opts?: OpenOptions) => Promise<void>
  /** Load PGN text (one game) and add it to the library. Returns an error message or null. */
  loadPgnText: (pgn: string, opts?: Omit<OpenOptions, 'at'> & { source?: GameSource; id?: string }) => string | null
  /** Import every game in a (multi-game) PGN into the library. Returns the number added. */
  importPgnFile: (text: string) => Promise<number>
  loadFenText: (fen: string) => string | null
  newBoard: () => void
  /** Save the game on the board to the library without reviewing it. */
  saveCurrent: () => StoredGame | null
  reviewTab: ReviewTab
  setReviewTab: (t: ReviewTab) => void
  /** The analysis board's engine switch (pauses background reviews while on). */
  liveEngine: boolean
  setLiveEngine: React.Dispatch<React.SetStateAction<boolean>>
  toast: (msg: string) => void
}

export const AppContext = createContext<AppState | null>(null)

export function useApp(): AppState {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}
