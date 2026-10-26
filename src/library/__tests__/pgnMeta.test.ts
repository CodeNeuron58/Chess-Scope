import { describe, expect, it } from 'vitest'
import {
  colorOfAccount,
  gameFromPgn,
  hashString,
  openingFamily,
  openingFromEcoUrl,
  outcomeFor,
  parseClocks,
  parseTimeControl,
  speedOf,
  splitPgn,
  tcShort,
} from '../pgnMeta'

const OPERA = `[Event "Paris"]
[Date "1858.11.02"]
[White "Paul Morphy"]
[Black "Allies"]
[Result "1-0"]
[TimeControl "600+5"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7
8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7
14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`

describe('splitPgn', () => {
  it('splits a multi-game file at each new header block', () => {
    const two = `${OPERA}\n\n[White "A"]\n[Black "B"]\n\n1. d4 d5 *\n`
    const games = splitPgn(two)
    expect(games).toHaveLength(2)
    expect(games[1]).toContain('1. d4 d5')
  })
  it('keeps a single game intact and ignores empty input', () => {
    expect(splitPgn(OPERA)).toHaveLength(1)
    expect(splitPgn('   ')).toEqual([])
  })
})

describe('time controls', () => {
  it('buckets speeds by estimated duration', () => {
    expect(speedOf('60')).toBe('bullet')
    expect(speedOf('180+2')).toBe('blitz')
    expect(speedOf('600+0')).toBe('rapid')
    expect(speedOf('5400+30')).toBe('classical')
    expect(speedOf('1/86400')).toBe('daily')
    expect(speedOf('-')).toBeUndefined()
  })
  it('parses and formats base + increment', () => {
    expect(parseTimeControl('600+5')).toEqual({ base: 600, inc: 5 })
    expect(tcShort('600+5')).toBe('10+5')
    expect(tcShort('180')).toBe('3+0')
    expect(tcShort('1/86400')).toBe('Daily')
  })
})

describe('parseClocks', () => {
  it('reads every %clk comment in order, in seconds', () => {
    const pgn = '1. e4 {[%clk 0:09:58.5]} e5 {[%clk 0:09:59]} 2. Nf3 {[%clk 1:00:00]}'
    expect(parseClocks(pgn)).toEqual([598.5, 599, 3600])
  })
})

describe('opening names', () => {
  it('turns a chess.com ECOUrl into a readable name', () => {
    expect(openingFromEcoUrl('https://www.chess.com/openings/Sicilian-Defense-Najdorf-Variation-6.Be3')).toBe('Sicilian Defense: Najdorf Variation')
    expect(openingFromEcoUrl('https://www.chess.com/openings/Philidor-Defense-3.d4-Bg4')).toBe('Philidor Defense')
    expect(openingFromEcoUrl(undefined)).toBeUndefined()
  })
  it('groups variations under their family', () => {
    expect(openingFamily('Sicilian Defense: Najdorf Variation')).toBe('Sicilian Defense')
    expect(openingFamily(undefined)).toBe('Unknown opening')
  })
})

describe('gameFromPgn', () => {
  it('extracts players, result, speed and a stable id', () => {
    const a = gameFromPgn(OPERA, 'upload')
    const b = gameFromPgn(OPERA, 'upload')
    expect(a.id).toBe(b.id)
    expect(a.id.startsWith('pgn:')).toBe(true)
    expect(a.white).toBe('Paul Morphy')
    expect(a.result).toBe('1-0')
    expect(a.plies).toBe(33)
    expect(a.speed).toBe('rapid')
    expect(a.opening).toBeTruthy()
  })
  it('detects the user side from connected account names', () => {
    expect(gameFromPgn(OPERA, 'upload', ['paul morphy']).userColor).toBe('w')
    expect(colorOfAccount('A', 'B', ['b'])).toBe('b')
    expect(colorOfAccount('A', 'B', [])).toBeUndefined()
  })
  it('throws on unreadable PGN', () => {
    expect(() => gameFromPgn('1. e4 e5 2. Ke5', 'upload')).toThrow()
  })
})

describe('outcomeFor / hashString', () => {
  it('reads results from either side', () => {
    expect(outcomeFor('1-0', 'w')).toBe('W')
    expect(outcomeFor('1-0', 'b')).toBe('L')
    expect(outcomeFor('1/2-1/2', 'b')).toBe('D')
    expect(outcomeFor('*', 'w')).toBeNull()
  })
  it('hashes deterministically', () => {
    expect(hashString('owl')).toBe(hashString('owl'))
    expect(hashString('owl')).not.toBe(hashString('owls'))
  })
})

describe('historic dates', () => {
  it('keeps the year when the PGN has no month or day', () => {
    const g = gameFromPgn('[Date "1858.??.??"]\n[White "A"]\n[Black "B"]\n\n1. e4 e5 *', 'upload')
    expect(new Date(g.playedAt).getUTCFullYear()).toBe(1858)
    expect(g.yearOnly).toBe(true)
  })
})
