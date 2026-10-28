import { describe, it, expect } from 'vitest'
import {
  calculatePremiumPriceUsdt,
  calculatePremiumPriceSlearn,
} from '../premium-pricing.js'

// Anclas (decisión del operador, 2026-10-28): Sierra Leona 0,50 y Estados
// Unidos 3,00 USDT. Colombia queda entre las dos, ya no es ancla.
describe('calculatePremiumPriceUsdt', () => {
  it('returns $0.50 for Sierra Leone (hdi 0.467)', () => {
    expect(calculatePremiumPriceUsdt(0.467)).toBe(0.5)
  })

  it('returns $3 for the United States (hdi 0.938)', () => {
    expect(calculatePremiumPriceUsdt(0.938)).toBe(3)
  })

  it('keeps Colombia between the anchors (hdi 0.788 → $2.20)', () => {
    expect(calculatePremiumPriceUsdt(0.788)).toBe(2.2)
  })

  it('keeps Ghana between the anchors (hdi 0.628 → $1.35)', () => {
    expect(calculatePremiumPriceUsdt(0.628)).toBe(1.35)
  })

  // Sin techo (decisión del operador, 2026-10-28): quien tiene más HDI que
  // Estados Unidos paga más de 3 USDT, no se le "protege".
  it('keeps growing above the United States anchor', () => {
    expect(calculatePremiumPriceUsdt(0.967)).toBeGreaterThan(3)
    expect(calculatePremiumPriceUsdt(1)).toBeGreaterThan(calculatePremiumPriceUsdt(0.967))
  })

  it('grows with the HDI between the anchors', () => {
    const prices = [0.467, 0.55, 0.628, 0.788, 0.85, 0.938].map(calculatePremiumPriceUsdt)
    for (let i = 1; i < prices.length; i++) expect(prices[i]).toBeGreaterThan(prices[i - 1])
  })
})

describe('calculatePremiumPriceSlearn', () => {
  it('applies the 10% SLEARN discount', () => {
    expect(calculatePremiumPriceSlearn(0.5, 22)).toBe(9.9)
    expect(calculatePremiumPriceSlearn(2.2, 22)).toBe(43.56)
    expect(calculatePremiumPriceSlearn(3, 22)).toBe(59.4)
  })

  it('rounds to 2 decimals', () => {
    expect(calculatePremiumPriceSlearn(1.35, 22)).toBe(26.73)
  })
})
