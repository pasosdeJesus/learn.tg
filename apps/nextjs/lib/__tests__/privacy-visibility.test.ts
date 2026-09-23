import { describe, it, expect } from 'vitest'
import { visibilityFromUser, canShowCoursePublicly } from '../privacy-visibility'

// Privacidad de la afiliación sensible
// (https://github.com/pasosdeJesus/learn.tg/issues/259 §3.2): los dos
// interruptores son un AND y sus valores por defecto importan — publicar cursos
// completados sí (comportamiento histórico), contenido sensible no.
describe('privacy-visibility', () => {
  describe('visibilityFromUser', () => {
    it('defaults to publishing courses but not sensitive content', () => {
      expect(visibilityFromUser(null)).toEqual({
        publicCourses: true,
        publicSensitiveCourses: false,
      })
      expect(visibilityFromUser(undefined)).toEqual({
        publicCourses: true,
        publicSensitiveCourses: false,
      })
      expect(visibilityFromUser({})).toEqual({
        publicCourses: true,
        publicSensitiveCourses: false,
      })
    })

    it('honours NULL the same as the defaults', () => {
      expect(visibilityFromUser({
        mostrar_cursos_publico: null,
        mostrar_cursos_sensibles_publico: null,
      })).toEqual({ publicCourses: true, publicSensitiveCourses: false })
    })

    it('only treats an explicit true as opting in to sensitive content', () => {
      expect(visibilityFromUser({ mostrar_cursos_sensibles_publico: true }).publicSensitiveCourses).toBe(true)
      expect(visibilityFromUser({ mostrar_cursos_sensibles_publico: false }).publicSensitiveCourses).toBe(false)
    })
  })

  describe('canShowCoursePublicly', () => {
    const curso = (sensitive: boolean) => ({ contenido_sensible: sensitive })

    it('hides everything when the owner turned publishing off', () => {
      for (const sensitive of [false, true]) {
        expect(canShowCoursePublicly(
          { mostrar_cursos_publico: false, mostrar_cursos_sensibles_publico: true },
          curso(sensitive),
        )).toBe(false)
      }
    })

    it('publishes non-sensitive courses by default', () => {
      expect(canShowCoursePublicly(null, curso(false))).toBe(true)
      expect(canShowCoursePublicly({ mostrar_cursos_sensibles_publico: true }, curso(false))).toBe(true)
    })

    it('hides sensitive courses until the category switch is on', () => {
      expect(canShowCoursePublicly(null, curso(true))).toBe(false)
      expect(canShowCoursePublicly({ mostrar_cursos_publico: true }, curso(true))).toBe(false)
      expect(canShowCoursePublicly(
        { mostrar_cursos_publico: true, mostrar_cursos_sensibles_publico: true },
        curso(true),
      )).toBe(true)
    })

    it('treats an unknown course as non-sensitive (an emission without course row)', () => {
      expect(canShowCoursePublicly(null, null)).toBe(true)
    })
  })
})
