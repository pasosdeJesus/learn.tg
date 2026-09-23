import { describe, it, expect } from 'vitest'
import { canMintPublicly } from '../course-privacy'

// Espejo del helper de la app: la regla de acuñación en cursos cristianos
// (https://github.com/pasosdeJesus/learn.tg/issues/259 §3.4).
describe('course-privacy / canMintPublicly', () => {
  it('always allows a non-Christian course (historical behaviour)', () => {
    expect(canMintPublicly(null)).toBe(true)
    expect(canMintPublicly({ contenido_cristiano: false })).toBe(true)
    expect(canMintPublicly({
      contenido_cristiano: false,
      mostrar_cursos_publico: false,
      mostrar_cursos_cristianos_publico: false,
    })).toBe(true)
  })

  it('blocks a Christian course by default', () => {
    expect(canMintPublicly({ contenido_cristiano: true })).toBe(false)
    expect(canMintPublicly({
      contenido_cristiano: true,
      mostrar_cursos_publico: true,
      mostrar_cursos_cristianos_publico: null,
    })).toBe(false)
  })

  it('allows a Christian course only with both switches on', () => {
    expect(canMintPublicly({
      contenido_cristiano: true,
      mostrar_cursos_publico: true,
      mostrar_cursos_cristianos_publico: true,
    })).toBe(true)
    // NULL in `mostrar_cursos_publico` is the TRUE default (row missing)
    expect(canMintPublicly({
      contenido_cristiano: true,
      mostrar_cursos_publico: null,
      mostrar_cursos_cristianos_publico: true,
    })).toBe(true)
  })

  it('blocks a Christian course when the global publishing switch is off', () => {
    expect(canMintPublicly({
      contenido_cristiano: true,
      mostrar_cursos_publico: false,
      mostrar_cursos_cristianos_publico: true,
    })).toBe(false)
  })
})
