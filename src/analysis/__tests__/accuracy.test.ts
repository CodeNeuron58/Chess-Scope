import { describe, expect, it } from 'vitest'
import { expectedAccuracy, expectedPoints, formatEval, gameRating, moveAccuracy, winPercent } from '../accuracy'

describe('winPercent (logistic conversion)', () => {
  it('is 50 at equality', () => {
    expect(winPercent(0)).toBeCloseTo(50, 5)
  })
  it('is monotonic increasing in centipawns', () => {
    for (let cp = -2000; cp < 2000; cp += 100) {
      expect(winPercent(cp + 100)).toBeGreaterThanOrEqual(winPercent(cp))
    }
  })
  it('saturates near 0/100 for extreme evals', () => {
    expect(winPercent(10000)).toBeGreaterThan(99.9)
    expect(winPercent(-10000)).toBeLessThan(0.1)
  })
})

describe('moveAccuracy (calibrated exponential)', () => {
  it('is 100 when the position does not worsen', () => {
    expect(moveAccuracy(50, 50)).toBeCloseTo(100, 3)
    expect(moveAccuracy(30, 70)).toBeCloseTo(100, 3)
  })
  it('decreases monotonically as the drop grows', () => {
    let prev = 100
    for (let drop = 0; drop <= 50; drop += 5) {
      const acc = moveAccuracy(80, 80 - drop)
      expect(acc).toBeLessThanOrEqual(prev)
      prev = acc
    }
  })
  it('is heavily penalized by the calibration scale (a 45-point drop ≈ 0)', () => {
    expect(moveAccuracy(100, 55)).toBeLessThan(1)
  })
})

describe('expectedPoints (rating-aware)', () => {
  it('is 0.5 at equality for any rating', () => {
    expect(expectedPoints(0, 900)).toBeCloseTo(0.5, 5)
    expect(expectedPoints(0, 2400)).toBeCloseTo(0.5, 5)
  })
  it('is worth more for stronger players', () => {
    expect(expectedPoints(150, 2300)).toBeGreaterThan(expectedPoints(150, 1000))
  })
  it('matches the plain win% curve when the rating is unknown', () => {
    expect(expectedPoints(200) * 100).toBeCloseTo(winPercent(200), 6)
  })
})

describe('gameRating', () => {
  it('without a rating maps the chess.com anchor accuracies to their observed ratings', () => {
    expect(gameRating(85.33)).toBeCloseTo(1454, -2)
    expect(gameRating(77.71)).toBeCloseTo(1201, -2)
    expect(gameRating(0)).toBe(600)
  })
  it('with a rating reproduces chess.com on the 2026 bullet anchor (71.7 / 70.8 → 1900)', () => {
    expect(gameRating(71.7, { elo: 2025, speed: 'bullet' })).toBe(1900)
    expect(gameRating(70.8, { elo: 2027, speed: 'bullet' })).toBe(1900)
  })
  it('rises 35 Elo per accuracy point above what is typical for the rating, in steps of 50', () => {
    const typical = expectedAccuracy(1500, 'rapid')
    expect(gameRating(typical, { elo: 1500, speed: 'rapid' })).toBe(1500)
    expect(gameRating(typical + 10, { elo: 1500, speed: 'rapid' })).toBe(1850)
    expect(gameRating(55, { elo: 1500, speed: 'rapid' }) % 50).toBe(0)
  })
  it('does not sink ~900-rated players far below chess.com (946, 12 points under typical → 550, was 350)', () => {
    const acc = expectedAccuracy(946, 'rapid') - 11.3
    expect(gameRating(acc, { elo: 946, speed: 'rapid' })).toBe(550)
  })
  it('uses typical accuracies measured from chess.com games', () => {
    expect(expectedAccuracy(900, 'blitz')).toBe(70.5)
    expect(expectedAccuracy(2100, 'rapid')).toBe(83)
    expect(expectedAccuracy(300, 'rapid')).toBe(60)
    expect(expectedAccuracy(100, 'rapid')).toBe(60)
    expect(expectedAccuracy(3200, 'blitz')).toBe(82.5)
  })
  it('never expects a stronger player to be less accurate', () => {
    for (const speed of ['bullet', 'blitz', 'rapid', 'classical', 'daily'] as const) {
      for (let r = 100; r < 3000; r += 50) expect(expectedAccuracy(r + 50, speed)).toBeGreaterThanOrEqual(expectedAccuracy(r, speed))
    }
  })
  it('expects faster games to be less accurate', () => {
    expect(expectedAccuracy(1800, 'bullet')).toBeLessThan(expectedAccuracy(1800, 'rapid'))
  })
})

describe('formatEval', () => {
  it('formats centipawn evals with an explicit sign', () => {
    expect(formatEval(0)).toBe('0.0')
    expect(formatEval(150)).toBe('+1.5')
    expect(formatEval(-150)).toBe('-1.5')
  })
  it('formats mate scores', () => {
    expect(formatEval(19800, 2)).toBe('M2')
    expect(formatEval(-19800, -2)).toBe('-M2')
  })
})
