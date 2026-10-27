import { describe, expect, it } from 'vitest'
import { asPreliminary } from '../review'
import { scholarsReview } from '../../library/__tests__/fixtures'

describe('asPreliminary', () => {
  it('shows Brilliant/Great as Best until the full pass confirms them, and recounts', () => {
    const full = scholarsReview()
    full.moves[4] = { ...full.moves[4], classification: 'great' }
    const quick = asPreliminary(full)
    expect(quick.preliminary).toBe(true)
    expect(quick.moves[4].classification).toBe('best')
    expect(quick.counts.white.great).toBeUndefined()
    expect(quick.counts.white.best).toBe(1)
    // errors are kept: they are reliable even at low depth
    expect(quick.moves[5].classification).toBe('blunder')
  })
})
