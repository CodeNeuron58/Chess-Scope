import type { Classification } from '../types'

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

/** Shared palette for board overlays (arrows, highlights). */
export const PALETTE = {
  accent: '#81b64c',
  arrowBest: 'rgba(129,182,76,0.9)',
  arrowSecond: 'rgba(143,139,132,0.55)',
  arrowThreat: 'rgba(250,65,45,0.9)',
  arrowReveal: 'rgba(250,65,45,0.85)',
  highlightLastMove: 'rgba(255, 213, 79, 0.42)',
  ringAccent: 'inset 0 0 0 3px #81b64c',
  ringSelection: 'inset 0 0 0 4px #81b64c',
  ringDanger: 'inset 0 0 0 3px #fa412d',
} as const

/** MultiPV line count requested from the engine. */
export const ENGINE_MULTIPV = 3

/** Per-position search timeout in ms (fallback if a deep search stalls). */
export function searchTimeoutMs(depth: number): number {
  return 30000 + depth * 1500
}
