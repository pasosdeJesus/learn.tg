import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useTranslation } from '../useTranslation'

describe('useTranslation', () => {
  it('should return English translation when lang is "en"', () => {
    const { result } = renderHook(() => useTranslation('en'))
    const t = result.current

    expect(t('Hello', 'Hola')).toBe('Hello')
    expect(t('Leaderboard', 'Tabla de Clasificación')).toBe('Leaderboard')
    expect(t('Transparency', 'Transparencia')).toBe('Transparency')
  })

  it('should return Spanish translation when lang is "es"', () => {
    const { result } = renderHook(() => useTranslation('es'))
    const t = result.current

    expect(t('Hello', 'Hola')).toBe('Hola')
    expect(t('Leaderboard', 'Tabla de Clasificación')).toBe('Tabla de Clasificación')
    expect(t('Transparency', 'Transparencia')).toBe('Transparencia')
  })

  it('should default to English when lang is not provided', () => {
    const { result } = renderHook(() => useTranslation())
    const t = result.current

    expect(t('Hello', 'Hola')).toBe('Hello')
    expect(t('Leaderboard', 'Tabla de Clasificación')).toBe('Leaderboard')
  })

  it('should default to English when lang is empty string', () => {
    const { result } = renderHook(() => useTranslation(''))
    const t = result.current

    expect(t('Hello', 'Hola')).toBe('Hello')
  })

  it('should return Spanish for any lang value that is "es" (case-sensitive)', () => {
    const { result } = renderHook(() => useTranslation('es'))
    const t = result.current

    expect(t('Hello', 'Hola')).toBe('Hola')
  })

  it('should return English for lang values other than "es"', () => {
    const { result } = renderHook(() => useTranslation('fr'))
    const t = result.current

    expect(t('Hello', 'Hola')).toBe('Hello')
  })

  it('should memoize translation function based on lang', () => {
    const { result, rerender } = renderHook(({ lang }) => useTranslation(lang), {
      initialProps: { lang: 'en' }
    })

    const firstResult = result.current
    expect(firstResult('Hello', 'Hola')).toBe('Hello')

    // Re-render with same lang, should return same function reference
    rerender({ lang: 'en' })
    expect(result.current).toBe(firstResult)

    // Re-render with different lang, should return new function reference
    rerender({ lang: 'es' })
    expect(result.current).not.toBe(firstResult)
    expect(result.current('Hello', 'Hola')).toBe('Hola')
  })
})