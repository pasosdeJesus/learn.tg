import { describe, it, expect } from 'vitest'
import { getSLEUSDRate } from '../sle-rate'

describe('getSLEUSDRate', () => {
  it('returns the current SLE/USD rate used for SLEARN conversions', async () => {
    expect(await getSLEUSDRate()).toBe(22)
  })

  it('produces a rate consistent with donation cashback (10% of USDT × rate)', async () => {
    // 10 USDT donation → 10% cashback → 22 SLEARN at rate 22
    const rate = await getSLEUSDRate()
    expect(Math.round(10 * 0.1 * rate)).toBe(22)
  })
})
