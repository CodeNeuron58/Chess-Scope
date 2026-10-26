import type { Classification, PhaseStats } from '../types'
import type { EngineChoice } from '../engine/engineClient'

export type GameSource = 'chesscom' | 'lichess' | 'upload' | 'board'
export type Speed = 'bullet' | 'blitz' | 'rapid' | 'classical' | 'daily'
export type GameResult = '1-0' | '0-1' | '1/2-1/2' | '*'
export type Color = 'w' | 'b'

/** A game in the local library (IndexedDB). The full review lives in a separate store. */
export interface StoredGame {
  /** 'cc:<uuid>' · 'li:<id>' · 'pgn:<hash>' */
  id: string
  source: GameSource
  pgn: string
  white: string
  black: string
  whiteElo?: number
  blackElo?: number
  result: GameResult
  /** When the game was played (ms epoch); falls back to the import time. */
  playedAt: number
  /** Set when the PGN only gives the year (historic games): show the year, not a day. */
  yearOnly?: boolean
  addedAt: number
  /** PGN TimeControl value, e.g. "600+5". */
  timeControl?: string
  speed?: Speed
  opening?: string
  eco?: string
  /** Number of half-moves. */
  plies: number
  /** The account owner's side, when the game came from a connected account. */
  userColor?: Color
  url?: string
  summary?: ReviewSummary
  /** Where the user left off in this game (for "Continue"). */
  lastPly?: number
  lastOpenedAt?: number
}

/** Compact per-move record kept for Insights (one entry per half-move). */
export interface MoveStat {
  c: Color
  /** Per-move accuracy, 0-100. */
  acc: number
  /** Mover's win% before the move. */
  win: number
  cls: Classification
  /** Mover's clock after the move, in seconds (from %clk comments). */
  clk?: number
  phase: 'opening' | 'middlegame' | 'endgame'
}

export type DrillTheme = 'mate' | 'fork' | 'hanging' | 'tactic' | 'win' | 'positional'

export interface DrillLine {
  uci: string
  san: string
  whiteCp: number
  mateIn?: number
  pvSan: string[]
}

/** A reviewed mistake, replayable as a drill. */
export interface DrillItem {
  /** `${gameId}:${ply}` */
  id: string
  gameId: string
  ply: number
  color: Color
  cls: Classification
  /** Position before the mistake. */
  fen: string
  played: { uci: string; san: string; whiteCp: number; mateIn?: number }
  /** Engine's top lines in the position before the mistake. */
  lines: DrillLine[]
  /** Mover's win% lost by the played move. */
  winLoss: number
  theme: DrillTheme
  /** Mate distance for 'mate' themes. */
  mateIn?: number
  phase: MoveStat['phase']
  /** Mover's clock before the move, in seconds. */
  clock?: number
}

export interface ReviewSummary {
  reviewedAt: number
  depth: number
  engine: EngineChoice
  accuracy: { white: number; black: number }
  rating: { white: number; black: number }
  acpl: { white: number; black: number }
  counts: {
    white: Partial<Record<Classification, number>>
    black: Partial<Record<Classification, number>>
  }
  phases: { white: PhaseStats; black: PhaseStats }
  moves: MoveStat[]
  mistakes: DrillItem[]
  /** Initial clock and increment in seconds, when the PGN carries them. */
  clock?: { base: number; inc: number }
}

export interface Accounts {
  chesscom: string
  lichess: string
  /** Optional Lichess personal API token — unlocks the Masters/Lichess opening explorer. */
  lichessToken: string
  /** Optional proxy base URL for chess.com's API. */
  chesscomProxy: string
}
