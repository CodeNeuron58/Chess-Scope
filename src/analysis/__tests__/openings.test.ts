import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { isBookPosition, openingInfo, openingName } from '../openings'

describe('opening book (Lichess chess-openings)', () => {
  it('names known lines with their ECO code', () => {
    expect(openingInfo(['e4', 'e5', 'Nf3', 'd6', 'd4', 'Bg4'])).toEqual({ eco: 'C41', name: 'Philidor Defense' })
    expect(openingName(['e4', 'c5'])).toBe('Sicilian Defense')
    expect(openingName(['e4'])).toBe("King's Pawn Game")
  })
  it('keeps the last named position once the game leaves theory', () => {
    expect(openingName(['e4', 'b6', 'Nf3', 'Bb7', 'd3', 'd6'])).toBe('Owen Defense')
  })
  it('recognises book positions reached by transposition', () => {
    const a = new Chess()
    for (const m of ['d4', 'Nf6', 'c4', 'e6']) a.move(m)
    const b = new Chess()
    for (const m of ['c4', 'e6', 'd4', 'Nf6']) b.move(m)
    expect(isBookPosition(a.fen())).toBe(true)
    expect(isBookPosition(b.fen())).toBe(true)
  })
  it('has nothing for positions far from theory', () => {
    expect(isBookPosition('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1')).toBe(false)
    expect(openingName([])).toBeNull()
  })
})
