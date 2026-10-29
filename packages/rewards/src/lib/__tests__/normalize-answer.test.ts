import { describe, it, expect } from 'vitest'
import { normalizeAnswer } from '../normalize-answer.js'

// Las respuestas del crucigrama se comparan letra por letra; mayúsculas, acentos y la
// tilde de la ñ no cuentan (2026-10-28).
describe('normalizeAnswer', () => {
  it('ignores the case', () => {
    expect(normalizeAnswer('cluster')).toBe('CLUSTER')
    expect(normalizeAnswer('Cluster')).toBe('CLUSTER')
  })

  it('folds the accented vowels', () => {
    expect(normalizeAnswer('país')).toBe('PAIS')
    expect(normalizeAnswer('PAÍS')).toBe('PAIS')
    expect(normalizeAnswer('menú')).toBe('MENU')
    expect(normalizeAnswer('pingüino')).toBe('PINGUINO')
  })

  it('folds the ñ so "enseña" and "ensena" are the same answer', () => {
    expect(normalizeAnswer('enseña')).toBe('ENSENA')
    expect(normalizeAnswer('ENSEÑA')).toBe('ENSENA')
    expect(normalizeAnswer('ensena')).toBe('ENSENA')
    expect(normalizeAnswer('año')).toBe('ANO')
  })

  it('leaves plain text, numbers and empty values alone', () => {
    expect(normalizeAnswer('UBI')).toBe('UBI')
    expect(normalizeAnswer('65')).toBe('65')
    expect(normalizeAnswer('')).toBe('')
    expect(normalizeAnswer(undefined)).toBe('')
  })
})
