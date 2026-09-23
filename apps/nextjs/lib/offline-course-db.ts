'use client'

import { COURSE_STORE, hasIndexedDB, withStore } from '@/lib/offline-db'
import { deleteGuide, saveGuide } from '@/lib/offline-guide-db'

/**
 * Descarga completa de un curso para leerlo sin conexión
 * (https://github.com/pasosdeJesus/learn.tg/issues/256).
 *
 * Un registro por curso **y idioma** (`key = `${lang}/${prefix}``). El registro
 * guarda los metadatos (qué curso, de quién era el derecho, cuándo se bajó, su
 * revisión) y, por guía, el crucigrama **sin respuestas**; el contenido de cada
 * guía vive en el store `guides` que ya usa `useCachedGuide` (una sola copia por
 * guía, y la página de guía la lee sin cambios).
 *
 * Decisión de privacidad (R-#259 §3.3 / R-#256 §3.6b): un curso `contenido_cristiano`
 * solo se descarga con el interruptor de publicar contenido cristiano encendido, y
 * el registro se borra cuando ese interruptor se apaga, cuando se desconecta la
 * billetera o cuando se borra la billetera. Así el propio registro no revela la
 * afiliación en un teléfono compartido, incluso sin conexión.
 */

export const REVALIDATION_MS = 24 * 60 * 60 * 1000

export interface DownloadedPuzzle {
  grid: unknown
  placements: unknown[]
}

export interface DownloadedGuide {
  /** Sufijo de ruta de la guía (`guide1`, `guia1`): la clave de `guides` es `key` + '/' + suffix. */
  suffix: string
  /** Crucigrama con celdas y pistas, nunca la solución. */
  puzzle: DownloadedPuzzle | null
}

export interface DownloadedCourse {
  key: string
  courseId: number
  lang: string
  /** Prefijo de ruta del curso, sin la barra inicial (`gdcluster`). */
  prefix: string
  titulo: string | null
  contenidoCristiano: boolean
  isPremium: boolean
  /** Billetera que descargó: un curso de pago no se lee con otra billetera. */
  wallet: string | null
  downloadedAt: number
  /** Hash del contenido descargado, para detectar cambios en el servidor. */
  revision: string
  guides: DownloadedGuide[]
  /** Tamaño aproximado del contenido guardado, en bytes. */
  bytes: number
}

const memory = new Map<string, DownloadedCourse>()

/** Clave del registro: un curso por idioma. */
export function courseKey(lang: string, prefix: string): string {
  return `${lang ?? ''}/${String(prefix ?? '').replace(/^\/+/, '')}`
}

/** Hash barato (djb2) del contenido, para comparar revisiones. */
export function computeRevision(parts: string[]): string {
  let hash = 5381
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) {
      hash = ((hash << 5) + hash + part.charCodeAt(i)) | 0
    }
    hash = ((hash << 5) + hash + 10) | 0
  }
  return (hash >>> 0).toString(36)
}

/** Tamaño aproximado en bytes del texto guardado (UTF-16 en el navegador). */
export function approximateBytes(parts: string[]): number {
  let total = 0
  for (const part of parts) total += part.length * 2
  return total
}

/**
 * ¿La copia tiene más de 24 h? Cuando no hay conexión no se revalida: el dato
 * solo decide si conviene refrescar la próxima vez que haya red.
 */
export function isStale(course: Pick<DownloadedCourse, 'downloadedAt'>, now: number = Date.now()): boolean {
  return now - course.downloadedAt >= REVALIDATION_MS
}

/** ¿El servidor tiene una revisión distinta a la copia? */
export function revisionChanged(course: Pick<DownloadedCourse, 'revision'>, remoteRevision: string): boolean {
  return course.revision !== remoteRevision
}

/**
 * Un curso de pago descargado con otra billetera no se lee (R-#256 §3.5): la
 * copia se puede borrar sin tocar el progreso ni las guías sin enviar.
 */
export function belongsToWallet(
  course: Pick<DownloadedCourse, 'isPremium' | 'wallet'>,
  wallet: string | null | undefined,
): boolean {
  if (!course.isPremium) return true
  if (!course.wallet) return false
  if (!wallet) return false
  return course.wallet.toLowerCase() === wallet.toLowerCase()
}

export async function saveDownloadedCourse(course: DownloadedCourse): Promise<void> {
  if (!hasIndexedDB()) {
    memory.set(course.key, course)
    return
  }
  try {
    await withStore(COURSE_STORE, 'readwrite', (store) => store.put(course))
  } catch {
    memory.set(course.key, course)
  }
}

export async function getDownloadedCourse(key: string): Promise<DownloadedCourse | null> {
  if (!hasIndexedDB()) return memory.get(key) ?? null
  try {
    const record = await withStore<DownloadedCourse | undefined>(COURSE_STORE, 'readonly', (store) => store.get(key))
    return record ?? memory.get(key) ?? null
  } catch {
    return memory.get(key) ?? null
  }
}

/** Cursos descargados en este dispositivo, más recientes primero. */
export async function listDownloadedCourses(): Promise<DownloadedCourse[]> {
  const fromMemory = () => [...memory.values()].sort((a, b) => b.downloadedAt - a.downloadedAt)
  if (!hasIndexedDB()) return fromMemory()
  try {
    const records = await withStore<DownloadedCourse[]>(COURSE_STORE, 'readonly', (store) => store.getAll())
    const merged = new Map<string, DownloadedCourse>()
    for (const record of [...(records ?? []), ...memory.values()]) merged.set(record.key, record)
    return [...merged.values()].sort((a, b) => b.downloadedAt - a.downloadedAt)
  } catch {
    return fromMemory()
  }
}

/**
 * Borra la copia descargada de un curso, incluidas las guías que había guardado
 * (para no dejar material legible suelto). Las respuestas en cola viven en su
 * propio store y **no** se tocan (R-#240 §4b item 9).
 */
export async function deleteDownloadedCourse(key: string): Promise<void> {
  const existing = await getDownloadedCourse(key)
  memory.delete(key)
  for (const guide of existing?.guides ?? []) {
    await deleteGuide(`${key}/${guide.suffix}`)
  }
  if (!hasIndexedDB()) return
  try {
    await withStore(COURSE_STORE, 'readwrite', (store) => store.delete(key))
  } catch {
    // la copia en memoria ya se borró
  }
}

/**
 * Borra copias descargadas por categoría. Se usa al desconectar la billetera, al
 * borrarla y al apagar el interruptor de contenido cristiano (R-#256 §3.5/§3.6b).
 */
export async function deleteDownloadedCourses(
  filter: { premium?: boolean; christian?: boolean; wallet?: string } = {},
): Promise<string[]> {
  const courses = await listDownloadedCourses()
  const deleted: string[] = []
  for (const course of courses) {
    const matchesPremium = filter.premium === undefined || course.isPremium === filter.premium
    const matchesChristian = filter.christian === undefined || course.contenidoCristiano === filter.christian
    const matchesWallet = filter.wallet === undefined
      || (course.wallet || '').toLowerCase() === filter.wallet.toLowerCase()
    if (matchesPremium && matchesChristian && matchesWallet) {
      await deleteDownloadedCourse(course.key)
      deleted.push(course.key)
    }
  }
  return deleted
}

/**
 * Guarda el contenido de una guía y la registra en el curso. El `markdown` es el
 * HTML que sirve `GET /api/guide` (lo mismo que cachea `useCachedGuide`), así que
 * la página de guía lo lee sin cambios.
 */
export async function saveCourseGuide(key: string, suffix: string, markdown: string): Promise<void> {
  await saveGuide(`${key}/${suffix}`, markdown)
}

/**
 * Borra las copias que no deben quedar en el dispositivo cuando la sesión
 * termina: los cursos de pago (ya no hay derecho comprobado) y los de contenido
 * cristiano (el interruptor de R-#259 vive en la sesión). Se llama al desconectar,
 * al borrar la billetera y al apagar el interruptor. Las respuestas en cola
 * (store `pending`) **no** se tocan: R-#240 §4b item 9.
 */
export async function clearPrivateCourseCopies(): Promise<string[]> {
  const courses = await listDownloadedCourses()
  const keys = courses
    .filter((course) => course.isPremium || course.contenidoCristiano)
    .map((course) => course.key)
  for (const key of keys) await deleteDownloadedCourse(key)
  return keys
}
