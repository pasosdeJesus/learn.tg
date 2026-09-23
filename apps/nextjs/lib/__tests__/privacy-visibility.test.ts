import { describe, it, expect } from 'vitest'
import { visibilityFromUser, canShowCoursePublicly } from '../privacy-visibility'

// Privacidad de la afiliación cristiana
// (https://github.com/pasosdeJesus/learn.tg/issues/259 §3.2): los dos
// interruptores son un AND y sus valores por defecto importan — publicar cursos
// completados sí (comportamiento histórico), contenido cristiano no.
describe('privacy-visibility', () => {
  describe('visibilityFromUser', () => {
    it('defaults to publishing courses but not Christian content', () => {
      expect(visibilityFromUser(null)).toEqual({
        publicCourses: true,
        publicChristianCourses: false,
      })
      expect(visibilityFromUser(undefined)).toEqual({
        publicCourses: true,
        publicChristianCourses: false,
      })
      expect(visibilityFromUser({})).toEqual({
        publicCourses: true,
        publicChristianCourses: false,
      })
    })

    it('honours NULL the same as the defaults', () => {
      expect(visibilityFromUser({
        mostrar_cursos_publico: null,
        mostrar_cursos_cristianos_publico: null,
      })).toEqual({ publicCourses: true, publicChristianCourses: false })
    })

    it('only treats an explicit true as opting in to Christian content', () => {
      expect(visibilityFromUser({ mostrar_cursos_cristianos_publico: true }).publicChristianCourses).toBe(true)
      expect(visibilityFromUser({ mostrar_cursos_cristianos_publico: false }).publicChristianCourses).toBe(false)
    })
  })

  describe('canShowCoursePublicly', () => {
    const curso = (christian: boolean) => ({ contenido_cristiano: christian })

    it('hides everything when the owner turned publishing off', () => {
      for (const christian of [false, true]) {
        expect(canShowCoursePublicly(
          { mostrar_cursos_publico: false, mostrar_cursos_cristianos_publico: true },
          curso(christian),
        )).toBe(false)
      }
    })

    it('publishes non-Christian courses by default', () => {
      expect(canShowCoursePublicly(null, curso(false))).toBe(true)
      expect(canShowCoursePublicly({ mostrar_cursos_cristianos_publico: true }, curso(false))).toBe(true)
    })

    it('hides Christian courses until the category switch is on', () => {
      expect(canShowCoursePublicly(null, curso(true))).toBe(false)
      expect(canShowCoursePublicly({ mostrar_cursos_publico: true }, curso(true))).toBe(false)
      expect(canShowCoursePublicly(
        { mostrar_cursos_publico: true, mostrar_cursos_cristianos_publico: true },
        curso(true),
      )).toBe(true)
    })

    it('treats an unknown course as non-Christian (an emission without course row)', () => {
      expect(canShowCoursePublicly(null, null)).toBe(true)
    })
  })
})
