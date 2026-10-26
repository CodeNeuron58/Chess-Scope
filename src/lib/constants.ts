import type { Classification } from '../types'
import type { EngineChoice } from '../engine/engineClient'

/** Classifications that mark a key moment (coach Explain/Best/reveal buttons). */
export const KEY_CLASSES: Classification[] = [
  'brilliant',
  'great',
  'inaccuracy',
  'mistake',
  'blunder',
  'miss',
]

/** Classifications that become mistake drills. */
export const MISTAKE_CLASSES: Classification[] = ['inaccuracy', 'mistake', 'blunder', 'miss']

/** Glyph, chip colour and wording for each move classification. */
export const CLASS_STYLE: Record<Classification, { glyph: string; color: string; label: string; verb: string; desc: string }> = {
  brilliant: { glyph: '!!', color: '#b48cff', label: 'Brilliant', verb: 'is brilliant', desc: 'A hard-to-find sacrifice that works' },
  great: { glyph: '!', color: '#5aa9ff', label: 'Great', verb: 'is a great move', desc: 'The only good move in a critical spot' },
  best: { glyph: '★', color: '#4fd1a1', label: 'Best', verb: 'is the best move', desc: 'The engine’s top choice' },
  excellent: { glyph: '✓', color: '#8fd6a8', label: 'Excellent', verb: 'is excellent', desc: 'Almost as good as the best move' },
  good: { glyph: '✓', color: '#a3b8ad', label: 'Good', verb: 'is good', desc: 'Close to best, small edge given up' },
  book: { glyph: 'B', color: '#c9a77c', label: 'Book', verb: 'is a book move', desc: 'Standard opening theory' },
  forced: { glyph: '→', color: '#8e98a8', label: 'Forced', verb: 'is forced', desc: 'The only legal move' },
  inaccuracy: { glyph: '?!', color: '#f2c94c', label: 'Inaccuracy', verb: 'is an inaccuracy', desc: 'Small loss of advantage' },
  mistake: { glyph: '?', color: '#f2994a', label: 'Mistake', verb: 'is a mistake', desc: 'Clear loss of advantage' },
  miss: { glyph: '×', color: '#ff7a8a', label: 'Miss', verb: 'is a miss', desc: 'Missed a winning chance' },
  blunder: { glyph: '??', color: '#ff4d4f', label: 'Blunder', verb: 'is a blunder', desc: 'Loses material or the game' },
}

/** Board overlay colours (arrows, highlights) shared across boards. */
export const PALETTE = {
  accent: '#9fd4b2',
  arrowThreat: '#ff6b6b',
  arrowGood: '#7bd389',
  arrowBad: '#ff4d4f',
  win: '#7bd389',
  loss: '#ff7a8a',
} as const

export type BoardThemeKey = 'forest' | 'club' | 'graphite' | 'olive' | 'ash'

export const BOARD_THEMES: Record<BoardThemeKey, { label: string; light: string; dark: string; highlight: string; arrow: string }> = {
  forest: { label: 'Forest', light: '#f1e8d4', dark: '#5b8a72', highlight: 'rgba(186,222,140,0.55)', arrow: '#e98a6b' },
  club: { label: 'Walnut', light: '#efe4cc', dark: '#a27a55', highlight: 'rgba(186,222,140,0.55)', arrow: '#e98a6b' },
  graphite: { label: 'Slate', light: '#dcd7cb', dark: '#738090', highlight: 'rgba(240,180,76,0.45)', arrow: '#f0b44c' },
  olive: { label: 'Olive', light: '#e8e4d0', dark: '#8a8f63', highlight: 'rgba(186,222,140,0.55)', arrow: '#e98a6b' },
  ash: { label: 'Ash', light: '#e6e2d8', dark: '#878d97', highlight: 'rgba(122,162,255,0.45)', arrow: '#7aa2ff' },
}

export type PieceSetKey = 'cburnett' | 'merida' | 'chessnut' | 'fantasy' | 'celtic'

/** Open-licensed piece sets from lichess-org/lila (see public/pieces/LICENSES.md). */
export const PIECE_SETS: Record<PieceSetKey, { label: string; licence: string; author: string }> = {
  cburnett: { label: 'Classic', licence: 'GPL-2.0+', author: 'Colin M.L. Burnett' },
  merida: { label: 'Merida', licence: 'GPL-2.0+', author: 'Armando Hernandez Marroquin' },
  chessnut: { label: 'Chessnut', licence: 'Apache-2.0', author: 'Alexis Luengas' },
  fantasy: { label: 'Fantasy', licence: 'MIT', author: 'Maurizio Monge' },
  celtic: { label: 'Celtic', licence: 'MIT', author: 'Maurizio Monge' },
}

export function pieceUrl(set: PieceSetKey, code: string): string {
  return `${import.meta.env.BASE_URL}pieces/${set}/${code}.svg`
}

export const ENGINE_OPTIONS: { value: EngineChoice; label: string; short: string; sub: string }[] = [
  { value: 'sf19-full', label: 'Stockfish 19', short: 'Stockfish 19', sub: 'Strongest · larger download' },
  { value: 'sf19-lite', label: 'Stockfish 19 lite', short: 'Stockfish 19 lite', sub: 'Loads faster · slightly weaker' },
  { value: 'sf16', label: 'Stockfish 16', short: 'Stockfish 16', sub: 'Previous generation' },
]

export const DEPTH_OPTIONS: { value: number; label: string; sub: string }[] = [
  { value: 10, label: 'Fast', sub: 'Quick pass · least accurate' },
  { value: 14, label: 'Standard', sub: 'Calibrated default · recommended' },
  { value: 18, label: 'Deep', sub: 'Slower · more accurate' },
  { value: 22, label: 'Max', sub: 'Very slow in a browser · beyond the calibrated depth' },
]


/** Search depth ceiling for the live analysis board. */
export const LIVE_MAX_DEPTH = 30
