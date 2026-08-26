import { describe, it, expect } from 'vitest'
import {
  calculatePremiumPriceUsdt,
  calculatePremiumPriceSlearn,
} from '../premium-pricing'

describe('calculatePremiumPriceUsdt', () => {
  it('returns $2 for Sierra Leone (hdi 0.467)', () => {
    expect(calculatePremiumPriceUsdt(0.467)).toBe(2)
  })

  it('returns $5 for Colombia (hdi 0.788)', () => {
    expect(calculatePremiumPriceUsdt(0.788)).toBe(5)
  })

  it('returns $3.50 for Ghana (hdi 0.628)', () => {
    expect(calculatePremiumPriceUsdt(0.628)).toBe(3.5)
  })

  it('returns $6.40 for United States (hdi 0.938)', () => {
    expect(calculatePremiumPriceUsdt(0.938)).toBe(6.4)
  })
})

describe('calculatePremiumPriceSlearn', () => {
  it('applies the 10% SLEARN discount', () => {
    expect(calculatePremiumPriceSlearn(2, 22)).toBe(39.6)
  })

  it('rounds to 2 decimals', () => {
    expect(calculatePremiumPriceSlearn(3.5, 22)).toBe(69.3)
  })
})
