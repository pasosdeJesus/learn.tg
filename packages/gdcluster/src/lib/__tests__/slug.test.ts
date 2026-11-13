import { describe, it, expect } from 'vitest'
import { normalizeSlug, suggestSlug, validateSlug, slugWithId } from '../slug.js'

describe('normalizeSlug', () => {
  it('quita acentos, baja a minúsculas y convierte a guiones', () => {
    expect(normalizeSlug('Iglesia Nueva Jerusalén')).toBe('iglesia-nueva-jerusalen')
    expect(normalizeSlug('  Cl 1 1 ')).toBe('cl-1-1')
    expect(normalizeSlug('A--B')).toBe('a-b')
  })
})

describe('suggestSlug', () => {
  it('usa las iniciales de las palabras', () => {
    expect(suggestSlug('Iglesia Nueva Jerusalén')).toBe('inj')
    expect(suggestSlug('Cluster Nuevo')).toBe('cn')
  })

  it('una palabra que empieza con dígito aporta sus dígitos', () => {
    expect(suggestSlug('Cl 1 1')).toBe('c11')
    expect(suggestSlug('Red 12 Iglesias')).toBe('r12i')
  })

  it('con una sola palabra usa la palabra completa', () => {
    expect(suggestSlug('Esperanza')).toBe('esperanza')
  })

  it('si las iniciales no llegan al mínimo usa el nombre normalizado', () => {
    expect(suggestSlug('A1')).toBe('a1')
    expect(suggestSlug('Él')).toBe('el')
  })

  it('devuelve vacío sin palabras', () => {
    expect(suggestSlug('   ')).toBe('')
    expect(suggestSlug('¡!')).toBe('')
  })
})

describe('validateSlug', () => {
  it('acepta minúsculas, dígitos y guiones simples', () => {
    expect(validateSlug('c11')).toEqual({ ok: true, slug: 'c11' })
    expect(validateSlug('iglesia-nueva-2')).toEqual({ ok: true, slug: 'iglesia-nueva-2' })
  })

  it('rechaza mayúsculas, acentos, guiones extremos o dobles y longitudes inválidas', () => {
    for (const bad of ['C11', 'café', '-c11', 'c11-', 'c--11', 'a', 'x'.repeat(41)]) {
      expect(validateSlug(bad)).toEqual({ ok: false, reason: 'slug_invalid' })
    }
  })
})

describe('slugWithId', () => {
  it('añade -<id> y respeta el máximo de 40', () => {
    expect(slugWithId('c11', 52)).toBe('c11-52')
    const long = slugWithId('x'.repeat(40), 1234)
    expect(long.length).toBeLessThanOrEqual(40)
    expect(long.endsWith('-1234')).toBe(true)
  })
})
