import { Chess } from 'chess.js'
import { openingName } from '../analysis/openings'
import type { Color, GameResult, GameSource, Speed, StoredGame } from './types'

/** FNV-1a 32-bit hash as hex — stable ids for uploaded games. */
export function hashString(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

/** Split a multi-game PGN file into single games. */
export function splitPgn(text: string): string[] {
  const normalized = text.replace(/\r\n?/g, '\n').trim()
  if (!normalized) return []
  const games: string[] = []
  let current: string[] = []
  let inMoves = false
  for (const line of normalized.split('\n')) {
    const isHeader = /^\s*\[\w+\s+".*"\]\s*$/.test(line)
    if (isHeader && inMoves) {
      games.push(current.join('\n').trim())
      current = []
      inMoves = false
    }
    if (!isHeader && line.trim()) inMoves = true
    current.push(line)
  }
  if (current.join('').trim()) games.push(current.join('\n').trim())
  return games
}

/** Speed bucket from a PGN TimeControl value (Lichess' estimated-duration rule). */
export function speedOf(timeControl: string | undefined): Speed | undefined {
  if (!timeControl || timeControl === '-' || timeControl === '?') return undefined
  if (timeControl.includes('/')) return 'daily'
  const [baseS, incS] = timeControl.split('+')
  const base = Number(baseS)
  const inc = Number(incS ?? 0)
  if (!Number.isFinite(base)) return undefined
  const estimate = base + 40 * (Number.isFinite(inc) ? inc : 0)
  if (estimate < 180) return 'bullet'
  if (estimate < 480) return 'blitz'
  if (estimate < 1500) return 'rapid'
  return 'classical'
}

/** "600+5" → { base: 600, inc: 5 }. */
export function parseTimeControl(timeControl: string | undefined): { base: number; inc: number } | undefined {
  if (!timeControl || timeControl.includes('/')) return undefined
  const [baseS, incS] = timeControl.split('+')
  const base = Number(baseS)
  const inc = Number(incS ?? 0)
  if (!Number.isFinite(base) || base <= 0) return undefined
  return { base, inc: Number.isFinite(inc) ? inc : 0 }
}

/** "600+5" → "10+5", "180" → "3+0", daily → "Daily". */
export function tcShort(timeControl: string | undefined): string {
  if (!timeControl || timeControl === '-') return '—'
  if (timeControl.includes('/')) return 'Daily'
  const tc = parseTimeControl(timeControl)
  if (!tc) return timeControl
  const base = tc.base >= 60 ? String(Math.round((tc.base / 60) * 10) / 10) : `${tc.base}s`
  return `${base}+${tc.inc}`
}

/** Clock readings (seconds) from [%clk h:mm:ss] comments, one per half-move. */
export function parseClocks(pgn: string): number[] {
  const out: number[] = []
  const re = /\[%clk\s+(\d+):(\d+):(\d+(?:\.\d+)?)\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(pgn)) !== null) {
    out.push(Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]))
  }
  return out
}

function parsePgnDate(date?: string, time?: string): number | undefined {
  if (!date) return undefined
  const m = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(date.trim())
  if (!m) {
    const y = /^(\d{4})\./.exec(date.trim())
    return y ? Date.UTC(Number(y[1]), 0, 1) : undefined
  }
  const t = time && /^\d{2}:\d{2}:\d{2}$/.test(time.trim()) ? time.trim() : '12:00:00'
  const ms = Date.parse(`${m[1]}-${m[2]}-${m[3]}T${t}Z`)
  return Number.isNaN(ms) ? undefined : ms
}

/** chess.com ECOUrl slug → readable opening name. */
export function openingFromEcoUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  const slug = url.split('/openings/')[1]
  if (!slug) return undefined
  const words: string[] = []
  for (const part of slug.split('-')) {
    if (/^\d/.test(part)) break
    words.push(decodeURIComponent(part))
  }
  if (words.length === 0) return undefined
  const text = words.join(' ')
  // "Sicilian Defense Najdorf Variation" → "Sicilian Defense: Najdorf Variation"
  const m = /^(.*?\b(?:Defense|Defence|Game|Opening|Gambit|Attack|System|Variation))\s+(.+)$/.exec(text)
  return m ? `${m[1]}: ${m[2]}` : text
}

/** The family part of an opening name ("Sicilian Defense: Najdorf" → "Sicilian Defense"). */
export function openingFamily(name: string | undefined): string {
  if (!name) return 'Unknown opening'
  return name.split(':')[0].split(',')[0].trim()
}

const STANDARD_PLACEMENT = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w'

export function isStandardStart(fen: string | undefined): boolean {
  return !fen || fen.startsWith(STANDARD_PLACEMENT)
}

function num(v: string | undefined): number | undefined {
  const n = Number(v)
  return v && Number.isFinite(n) && n > 0 ? n : undefined
}

function cleanName(v: string | undefined, fallback: string): string {
  return v && v !== '?' && v.trim() ? v.trim() : fallback
}

export interface ParsedGame {
  chess: Chess
  headers: Record<string, string>
  meta: Omit<StoredGame, 'id' | 'source' | 'addedAt'>
}

/** Parse one PGN into library metadata. Throws when the PGN is invalid. */
export function parseGame(pgn: string): ParsedGame {
  const chess = new Chess()
  chess.loadPgn(pgn.trim())
  const h = chess.getHeaders()
  const sans = chess.history()
  const resultHeader = h.Result as GameResult | undefined
  let result: GameResult = resultHeader && ['1-0', '0-1', '1/2-1/2'].includes(resultHeader) ? resultHeader : '*'
  if (result === '*' && chess.isCheckmate()) result = chess.turn() === 'w' ? '0-1' : '1-0'
  const opening =
    (h.Opening && h.Opening !== '?' ? h.Opening : undefined) ??
    openingFromEcoUrl(h.ECOUrl) ??
    (isStandardStart(h.FEN) ? openingName(sans) ?? undefined : undefined)
  return {
    chess,
    headers: h,
    meta: {
      pgn: pgn.trim(),
      white: cleanName(h.White, 'White'),
      black: cleanName(h.Black, 'Black'),
      whiteElo: num(h.WhiteElo),
      blackElo: num(h.BlackElo),
      result,
      playedAt: parsePgnDate(h.UTCDate ?? h.EndDate ?? h.Date, h.UTCTime ?? h.EndTime) ?? Date.now(),
      yearOnly: /^\d{4}\.\?\?/.test((h.UTCDate ?? h.Date ?? '').trim()) || undefined,
      timeControl: h.TimeControl && h.TimeControl !== '-' ? h.TimeControl : undefined,
      speed: speedOf(h.TimeControl),
      opening,
      eco: h.ECO && h.ECO !== '?' ? h.ECO : undefined,
      plies: sans.length,
      url: h.Link ?? (h.Site?.startsWith('http') ? h.Site : undefined),
    },
  }
}

/** Build a library record for a PGN the user loaded or played. */
export function gameFromPgn(pgn: string, source: GameSource, accounts: string[] = []): StoredGame {
  const { chess, headers, meta } = parseGame(pgn)
  const movesKey = chess.history().join(' ')
  const id = `pgn:${hashString(`${meta.white}|${meta.black}|${headers.Date ?? ''}|${headers.FEN ?? ''}|${movesKey}`)}`
  return { ...meta, id, source, addedAt: Date.now(), userColor: colorOfAccount(meta.white, meta.black, accounts) }
}

/** The side played by one of the given account names, if any. */
export function colorOfAccount(white: string, black: string, accounts: string[]): Color | undefined {
  const names = accounts.map((a) => a.trim().toLowerCase()).filter(Boolean)
  if (names.includes(white.toLowerCase())) return 'w'
  if (names.includes(black.toLowerCase())) return 'b'
  return undefined
}

/** Game result from one side's perspective. */
export function outcomeFor(result: GameResult, color: Color): 'W' | 'L' | 'D' | null {
  if (result === '1/2-1/2') return 'D'
  if (result === '1-0') return color === 'w' ? 'W' : 'L'
  if (result === '0-1') return color === 'b' ? 'W' : 'L'
  return null
}
