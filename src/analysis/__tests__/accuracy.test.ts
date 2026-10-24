import { describe, expect, it } from 'vitest'
import { formatEval, gameRating, moveAccuracy, winPercent } from '../accuracy'

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

describe('gameRating (Elo-style mapping)', () => {
  it('maps the chess.com anchor accuracies to their observed ratings', () => {
    expect(gameRating(85.33)).toBeCloseTo(1454, -2)
    expect(gameRating(77.71)).toBeCloseTo(1201, -2)
  })
  it('stays within the clamp range', () => {
    expect(gameRating(0)).toBe(600)
    expect(gameRating(100)).toBeLessThanOrEqual(2900)
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
