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
