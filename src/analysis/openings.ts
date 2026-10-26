/**
 * Opening book and names from the Lichess chess-openings dataset (CC0,
 * ~3,900 named lines; built into openingBook.json by scripts/build-openings.mjs).
 *
 * Lookups are by position (placement + side to move + castling), so a move is
 * "book" whenever it reaches a position on any named line — transpositions
 * included — and a game's opening name is the last named position it reached.
 */
import { Chess } from 'chess.js'
import data from './openingBook.json'

interface BookData {
  names: [string, string][]
  /** position key → index into names, or -1 for an unnamed book position */
  book: Record<string, number>
}

const BOOK = data as unknown as BookData

/** Same key as scripts/build-openings.mjs: FNV-1a (base 36) of the first three FEN fields. */
export function bookKey(fen: string): string {
  const s = fen.split(' ').slice(0, 3).join(' ')
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

export interface OpeningInfo {
  eco: string
  name: string
}

/** True when the position appears on a named opening line. */
export function isBookPosition(fen: string): boolean {
  return BOOK.book[bookKey(fen)] !== undefined
}

/** The opening named exactly at this position, if any. */
export function openingAt(fen: string): OpeningInfo | null {
  const idx = BOOK.book[bookKey(fen)]
  if (idx === undefined || idx < 0) return null
  const [eco, name] = BOOK.names[idx]
  return { eco, name }
}

/** The last named opening along a sequence of positions (a game's FENs). */
export function openingOf(fens: string[]): OpeningInfo | null {
  let found: OpeningInfo | null = null
  for (const fen of fens.slice(0, 60)) {
    const here = openingAt(fen)
    if (here) found = here
  }
  return found
}

/** Opening for a SAN sequence played from the standard start. */
export function openingInfo(sans: string[]): OpeningInfo | null {
  const board = new Chess()
  const fens: string[] = []
  for (const san of sans.slice(0, 60)) {
    try {
      board.move(san)
    } catch {
      break
    }
    fens.push(board.fen())
  }
  return openingOf(fens)
}

/** Name of the opening for a SAN sequence played from the standard start. */
export function openingName(sans: string[]): string | null {
  return openingInfo(sans)?.name ?? null
}
