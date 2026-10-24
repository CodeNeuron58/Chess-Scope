import type { Move } from 'chess.js'

export type { Move }

export type Classification =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'book'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'miss'
  | 'forced'

/** One analyzed position (index = number of plies played before it). */
export interface PlyReview {
  index: number
  fen: string
  /** Evaluation in centipawns from White's perspective (mate ≈ ±20000). */
  whiteCp: number
  /** Positive = White is mating in n, negative = Black is mating in n. */
  mateIn?: number
  /** Top engine lines, lines[0] is the engine's best. */
  lines: EngineLine[]
  bestUci: string
}

export interface EngineLine {
  /** First move of the line, e.g. "e2e4". */
  uciFirst: string
  pvUci: string[]
  pvSan: string[]
  whiteCp: number
  mateIn?: number
}

export interface MoveReview {
  /** 1-based ply index. */
  ply: number
  move: Move
  classification: Classification
  /** Per-move accuracy for the player who made this move (0-100). */
  accuracy: number
  /** Win% for the mover, before and after the move. */
  winBefore: number
  winAfter: number
  isBook: boolean
  /** Mover's material change in pawns (negative = sacrifice). */
  materialDelta: number
  secondBestWhiteCp?: number
  /** Coach commentary for the interactive review. */
  speech: string
  /** Longer explanation for notable moves (Explain button). */
  explain?: string
  /** Notable enough to warrant Explain/Best buttons. */
  isKeyMove?: boolean
}

export interface SkillMeter {
  key: string
  label: string
  taken: number
  target: number
}

export interface PlayerSkills {
  meters: SkillMeter[]
}

export interface PhaseStats {
  opening: number
  tactics: number
  strategy: number
  endgame: number
  counts: { opening: number; tactics: number; strategy: number; endgame: number }
}

export interface ReviewResult {
  positions: PlyReview[]
  moves: MoveReview[]
  whiteAccuracy: number
  blackAccuracy: number
  depth: number
  counts: {
    white: Partial<Record<Classification, number>>
    black: Partial<Record<Classification, number>>
  }
  /** Elo-style performance score per player (approximation of chess.com's Game Rating). */
  gameRating: { white: number; black: number }
  /** Average centipawn loss per move (standard absolute quality metric). */
  acpl: { white: number; black: number }
  skills: { white: PlayerSkills; black: PlayerSkills }
  /** chess.com's premium "Advanced Stats" equivalent: accuracy per position type. */
  advanced: { white: PhaseStats; black: PhaseStats }
}

export interface PlayerInfo {
  white: string
  black: string
}
