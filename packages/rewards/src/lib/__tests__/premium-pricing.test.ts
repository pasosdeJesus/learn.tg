import { describe, it, expect } from 'vitest'
import {
  calculatePremiumPriceUsdt,
  calculatePremiumPriceSlearn,
} from '../premium-pricing'

describe('calculatePremiumPriceUsdt', () => {
  it('returns $0.70 for Sierra Leone (hdi 0.467)', () => {
    expect(calculatePremiumPriceUsdt(0.467)).toBe(0.7)
  })

  it('returns $3 for Colombia (hdi 0.788)', () => {
    expect(calculatePremiumPriceUsdt(0.788)).toBe(3)
  })

  it('returns $1.85 for Ghana (hdi 0.628)', () => {
    expect(calculatePremiumPriceUsdt(0.628)).toBe(1.85)
  })

  it('returns $4.07 for United States (hdi 0.938)', () => {
    expect(calculatePremiumPriceUsdt(0.938)).toBe(4.07)
  })
})

describe('calculatePremiumPriceSlearn', () => {
  it('applies the 10% SLEARN discount', () => {
    expect(calculatePremiumPriceSlearn(0.7, 22)).toBe(13.86)
    expect(calculatePremiumPriceSlearn(3, 22)).toBe(59.4)
  })

  it('rounds to 2 decimals', () => {
    expect(calculatePremiumPriceSlearn(1.85, 22)).toBe(36.63)
  })
})
