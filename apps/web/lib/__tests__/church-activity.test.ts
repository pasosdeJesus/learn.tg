import { describe, it, expect } from 'vitest'
import { computeActivityScores } from '@/lib/church-activity'

function church(id: number, over: Partial<Record<string, number>> = {}) {
  return {
    church_id: id,
    guide_score_sum: 0,
    referral_count_sum: 0,
    donations_usdt_sum: 0,
    sbt_count_sum: 0,
    slearn_balance_sum: 0,
    profilescore_sum: 0,
    ...over,
  }
}

describe('computeActivityScores (R-#164 §4.1)', () => {
  it('is empty for an empty population', () => {
    expect(computeActivityScores([]).size).toBe(0)
  })

  it('gives 0 to a single church (flat population)', () => {
    const scores = computeActivityScores([church(1, { guide_score_sum: 7 })])
    expect(scores.get(1)).toBe(0)
  })

  it('gives 0 to identical churches (flat component)', () => {
    const scores = computeActivityScores([
      church(1, { guide_score_sum: 5 }),
      church(2, { guide_score_sum: 5 }),
    ])
    expect(scores.get(1)).toBe(0)
    expect(scores.get(2)).toBe(0)
  })

  it('normalizes min-max over ln(1+x): the max guide sum earns the guide weight (35)', () => {
    const scores = computeActivityScores([
      church(1, { guide_score_sum: 0 }),
      church(2, { guide_score_sum: 10 }),
    ])
    expect(scores.get(1)).toBe(0)
    expect(scores.get(2)).toBe(35)
  })

  it('a church that is the max in all six components earns 100', () => {
    const scores = computeActivityScores([
      church(1),
      church(2, {
        guide_score_sum: 10,
        referral_count_sum: 4,
        donations_usdt_sum: 20,
        sbt_count_sum: 3,
        slearn_balance_sum: 50,
        profilescore_sum: 90,
      }),
    ])
    expect(scores.get(2)).toBe(100)
    expect(scores.get(1)).toBe(0)
  })

  it('a flat component contributes 0 even when other components differ', () => {
    // profilescore is flat (all 9); only the guide sums differ.
    const scores = computeActivityScores([
      church(1, { profilescore_sum: 9 }),
      church(2, { profilescore_sum: 9, guide_score_sum: 10 }),
    ])
    expect(scores.get(2)).toBe(35)
  })

  it('accepts numeric strings (Postgres NUMERIC) and nulls', () => {
    const scores = computeActivityScores([
      church(1, { guide_score_sum: '0' as any, donations_usdt_sum: null as any }),
      church(2, { guide_score_sum: '8' as any, donations_usdt_sum: '3' as any }),
    ])
    expect(scores.get(2)).toBeGreaterThan(0)
  })
})
