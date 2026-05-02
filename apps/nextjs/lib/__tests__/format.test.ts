import { describe, it, expect } from 'vitest'
import {
  formatNumber,
  formatCurrency,
  formatLearningPoints,
  formatUSDT,
  formatCELO,
  t,
} from '../format'

describe('formatNumber', () => {
  it('formats with default options', () => {
    expect(formatNumber(1234567.89)).toBe('1,234,567.89')
  })

  it('formats zero', () => {
    expect(formatNumber(0)).toBe('0')
  })

  it('formats small numbers', () => {
    expect(formatNumber(42)).toBe('42')
  })

  it('formats with custom decimal places', () => {
    expect(formatNumber(123.456, { minimumFractionDigits: 2, maximumFractionDigits: 4 })).toBe('123.456')
  })

  it('formats with minimum fraction digits', () => {
    expect(formatNumber(5, { minimumFractionDigits: 2 })).toBe('5.00')
  })

  it('formats negative numbers', () => {
    expect(formatNumber(-1000.5)).toBe('-1,000.5')
  })

  it('formats with different locale', () => {
    expect(formatNumber(1234.56, { locale: 'de-DE' })).toBe('1.234,56')
  })
})

describe('formatCurrency', () => {
  it('formats USD by default', () => {
    const result = formatCurrency(1234.56)
    expect(result).toContain('1,234.56')
  })

  it('formats CELO with symbol replacement', () => {
    const result = formatCurrency(100.5, 'CELO')
    expect(result).not.toContain('$')
    expect(result).toContain('CELO')
  })

  it('hides currency symbol when displayCurrency is false', () => {
    const result = formatCurrency(99.99, 'USD', { displayCurrency: false })
    expect(result).toBe('99.99')
  })

  it('formats zero', () => {
    expect(formatCurrency(0)).toContain('0.00')
  })
})

describe('formatLearningPoints', () => {
  it('formats without decimals', () => {
    expect(formatLearningPoints(1500)).toBe('1,500')
  })

  it('strips decimals from float input', () => {
    expect(formatLearningPoints(99.7)).toBe('100')
  })

  it('formats zero', () => {
    expect(formatLearningPoints(0)).toBe('0')
  })
})

describe('formatUSDT', () => {
  it('formats with two decimals', () => {
    const result = formatUSDT(250.5)
    expect(result).toContain('250.50')
  })
})

describe('formatCELO', () => {
  it('replaces USD symbol with CELO', () => {
    const result = formatCELO(50)
    expect(result).toContain('CELO')
    expect(result).not.toContain('$')
  })

  it('formats with two decimals', () => {
    const result = formatCELO(10)
    expect(result).toContain('10.00')
  })
})

describe('t', () => {
  it('returns English by default', () => {
    expect(t('hello', 'hola')).toBe('hello')
  })

  it('returns English when lang is undefined', () => {
    expect(t('hello', 'hola', undefined)).toBe('hello')
  })

  it('returns Spanish when lang is es', () => {
    expect(t('hello', 'hola', 'es')).toBe('hola')
  })

  it('returns English for other languages', () => {
    expect(t('hello', 'hola', 'fr')).toBe('hello')
  })
})
