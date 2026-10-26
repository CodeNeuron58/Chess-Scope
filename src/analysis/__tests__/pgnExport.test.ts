import { describe, expect, it } from 'vitest'
import { buildReviewedPgn } from '../pgnExport'
import { openingName } from '../openings'
import type { MoveReview } from '../../types'

function review(san: string, classification: string, ply: number): MoveReview {
  return {
    ply,
    move: { color: ply % 2 === 1 ? 'w' : 'b', san } as MoveReview['move'],
    classification: classification as MoveReview['classification'],
    accuracy: 90,
    winBefore: 50,
    winAfter: 50,
    isBook: classification === 'book',
    materialDelta: 0,
    speech: '',
  }
}

describe('buildReviewedPgn', () => {
  it('maps classifications to standard NAGs', () => {
    const pgn = buildReviewedPgn(
      [
        review('e4', 'best', 1),
        review('e5', 'book', 2),
        review('Qh5', 'brilliant', 3),
        review('Nc6', 'blunder', 4),
        review('Bc4', 'inaccuracy', 5),
        review('Nf6', 'mistake', 6),
        review('Qxf7#', 'great', 7),
      ],
      { white: 'A', black: 'B' },
      '1-0',
    )
    expect(pgn).toContain('e4')
    expect(pgn).not.toContain('$14') // book maps to no NAG
    expect(pgn).toContain('Qh5 $3')
    expect(pgn).toContain('Nc6 $6')
    expect(pgn).toContain('Bc4 $4')
    expect(pgn).toContain('Nf6 $2')
    expect(pgn).toContain('Qxf7# $1')
  })

  it('includes headers and result', () => {
    const pgn = buildReviewedPgn([review('e4', 'best', 1)], { white: 'W', black: 'B' }, '1-0')
    expect(pgn).toContain('[Event "Owlchess Game Review"]')
    expect(pgn).toContain('[White "W"]')
    expect(pgn).toContain('[Black "B"]')
    expect(pgn).toContain('[Result "1-0"]')
    expect(pgn.trim().endsWith('1-0')).toBe(true)
  })
})

describe('openingName', () => {
  it('names a known opening line', () => {
    expect(openingName(['e4', 'e5', 'Nf3', 'd6', 'd4', 'Bg4'])).toBe('Philidor Defence')
  })
  it('falls back to the generic branch early', () => {
    expect(openingName(['e4', 'c5'])).toBe('Sicilian Defence')
    expect(openingName(['e4'])).toBe("King's Pawn Game")
  })
  it('returns null for out-of-book sequences', () => {
    expect(openingName(['a4', 'h5', 'g4'])).toBeNull()
  })
})
