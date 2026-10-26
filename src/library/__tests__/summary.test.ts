import { describe, expect, it } from 'vitest'
import { buildSummary, extractMistakes, themeLabel } from '../summary'
import { choicesFor, judge, promptFor, userDrills } from '../drills'
import { kpis, leaks, userGames } from '../stats'
import { buildExplorerIndex, lookupExplorer } from '../explorer'
import { scholarsReview, storedGame } from './fixtures'
import { DEFAULT_POSITION } from 'chess.js'

describe('extractMistakes', () => {
  const items = extractMistakes(scholarsReview(), 'g1')

  it('keeps only mistakes, with ids, sides and the played move', () => {
    expect(items.map((m) => m.ply)).toEqual([6, 7])
    expect(items[0]).toMatchObject({ id: 'g1:6', color: 'b', cls: 'blunder', played: { san: 'Nf6' } })
    expect(items[0].winLoss).toBeGreaterThan(40)
  })

  it('tags a missed forced mate with its distance', () => {
    const miss = items[1]
    expect(miss.theme).toBe('mate')
    expect(miss.mateIn).toBe(1)
    expect(themeLabel(miss)).toBe('Mate in 1')
    expect(promptFor(miss)).toBe('Mate in 1. Find the first move.')
  })
})

describe('buildSummary', () => {
  it('stores one compact stat per move and the time control', () => {
    const s = buildSummary(scholarsReview(), { gameId: 'g1', pgn: '1. e4 e5 *', timeControl: '300+3', engine: 'sf19-full' })
    expect(s.moves).toHaveLength(7)
    expect(s.moves[0]).toMatchObject({ c: 'w', phase: 'opening' })
    expect(s.mistakes).toHaveLength(2)
    expect(s.clock).toEqual({ base: 300, inc: 3 })
  })
})

describe('drills', () => {
  const [blunder, miss] = extractMistakes(scholarsReview(), 'g1')

  it('offers four distinct legal choices including the best and the game move', () => {
    const choices = choicesFor(blunder)
    expect(choices).toHaveLength(4)
    expect(new Set(choices.map((c) => c.uci)).size).toBe(4)
    expect(choices.some((c) => c.uci === 'g7g6')).toBe(true)
    expect(choices.some((c) => c.isGameMove && c.san === 'Nf6')).toBe(true)
  })

  it('accepts moves that keep the evaluation and rejects the blunder', () => {
    expect(judge(blunder, 40).ok).toBe(true)
    expect(judge(blunder, 45).ok).toBe(true)
    expect(judge(blunder, blunder.played.whiteCp).ok).toBe(false)
    expect(judge(miss, 19900).ok).toBe(true)
    expect(judge(miss, 30).ok).toBe(false)
  })

  it('collects only the user’s own mistakes from the library', () => {
    const summary = buildSummary(scholarsReview(), { gameId: 'pgn:test', pgn: '', engine: 'sf19-full' })
    const games = [storedGame({ summary })]
    expect(userDrills(games, ['me']).map((d) => d.color)).toEqual(['w'])
    expect(userDrills(games, ['them']).map((d) => d.color)).toEqual(['b'])
    expect(userDrills(games, [])).toEqual([])
  })
})

describe('stats', () => {
  const summary = buildSummary(scholarsReview(), { gameId: 'pgn:test', pgn: '', engine: 'sf19-full' })
  const list = userGames([storedGame({ summary }), storedGame({ id: 'pgn:2', result: '0-1', summary })], ['me'])

  it('computes the user’s accuracy, score and blunder rate', () => {
    const k = kpis(list)
    expect(k.games).toBe(2)
    expect(k.accuracy).toBeCloseTo(85)
    expect(k.score).toBeCloseTo(50)
    expect(k.blundersPerGame).toBe(0)
  })

  it('splits lost win% by cause, summing to 100', () => {
    const l = leaks(list)
    expect(l.length).toBeGreaterThan(0)
    expect(l.reduce((s, x) => s + x.share, 0)).toBeCloseTo(100)
    expect(l[0].key).toBe('tactics')
  })
})

describe('local explorer', () => {
  it('tallies next moves and the user’s score from a position', () => {
    const games = [
      storedGame({ id: 'a', pgn: '1. e4 e5 *', result: '1-0', userColor: 'w' }),
      storedGame({ id: 'b', pgn: '1. e4 c5 *', result: '0-1', userColor: 'w' }),
      storedGame({ id: 'c', pgn: '1. d4 d5 *', result: '1/2-1/2', userColor: 'w' }),
    ]
    const ex = lookupExplorer(buildExplorerIndex(games, []), DEFAULT_POSITION)
    expect(ex.reached).toBe(3)
    expect(ex.moves[0]).toMatchObject({ san: 'e4', total: 2, white: 1, black: 1 })
    expect(ex.userPoints).toBe(1.5)
    expect(ex.userGames).toBe(3)
  })
})
