'use client'

/**
 * Última lista de cursos vista con conexión (R-#240 §4b, pedido del operador el
 * 2026-09-21).
 *
 * El operador encontró que el menú ☰ → Courses, sin conexión, mostraba la página
 * de respaldo ("You are offline") en vez de la lista: el listado se sirve por
 * `fetch` y la página solo se cachea si antes se visitó. Con este respaldo la
 * página muestra la última lista guardada (y avisa de que puede estar vieja).
 *
 * Nota: solo cubre "ya visité el sitio con conexión al menos una vez". La descarga
 * completa de cursos sin conexión (incluido el primer uso) es el alcance de R-#240
 * §4b.
 */
const KEY = (lang: string) => `learn.tg.coursesCache.${lang}`

export interface CachedCatalog<T> {
  courses: T[]
  savedAt: number
}

export function saveCourseCatalog<T>(lang: string, courses: T[]): void {
  if (!Array.isArray(courses) || courses.length === 0) return
  try {
    localStorage.setItem(KEY(lang), JSON.stringify({ courses, savedAt: Date.now() }))
  } catch {
    // almacenamiento bloqueado: sin respaldo, pero nada se rompe
  }
}

export function getCourseCatalog<T>(lang: string): CachedCatalog<T> | null {
  try {
    const raw = localStorage.getItem(KEY(lang))
    if (raw === null) return null
    const parsed = JSON.parse(raw) as CachedCatalog<T>
    return Array.isArray(parsed?.courses) ? parsed : null
  } catch {
    return null
  }
}

export function clearCourseCatalog(lang: string): void {
  try {
    localStorage.removeItem(KEY(lang))
  } catch {
    // idem
  }
}

const EXTRA_KEY = (lang: string) => `learn.tg.courseExtrasCache.${lang}`

export interface CachedCourseExtras<T> {
  extras: Array<[number, T]>
  savedAt: number
}

/**
 * Último avance por curso visto con conexión (https://github.com/pasosdeJesus/learn.tg/issues/272).
 * Permite que los tres círculos de la tarjeta tengan algo que mostrar sin conexión
 * (USDT/SLEARN solo verde o gris, nunca amarillo: el saldo de la bóveda no se conoce).
 */
export function saveCourseExtras<T>(lang: string, extras: Map<number, T>): void {
  if (!(extras instanceof Map) || extras.size === 0) return
  try {
    localStorage.setItem(
      EXTRA_KEY(lang),
      JSON.stringify({ extras: Array.from(extras.entries()), savedAt: Date.now() }),
    )
  } catch {
    // almacenamiento bloqueado: sin respaldo, pero nada se rompe
  }
}

export function getCourseExtras<T>(lang: string): Map<number, T> | null {
  try {
    const raw = localStorage.getItem(EXTRA_KEY(lang))
    if (raw === null) return null
    const parsed = JSON.parse(raw) as CachedCourseExtras<T>
    if (!Array.isArray(parsed?.extras)) return null
    return new Map(parsed.extras)
  } catch {
    return null
  }
}

export function clearCourseExtras(lang: string): void {
  try {
    localStorage.removeItem(EXTRA_KEY(lang))
  } catch {
    // idem
  }
}
