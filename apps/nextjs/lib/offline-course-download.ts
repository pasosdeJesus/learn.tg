'use client'

import {
  approximateBytes,
  computeRevision,
  courseKey,
  getDownloadedCourse,
  saveCourseGuide,
  saveDownloadedCourse,
  type DownloadedCourse,
  type DownloadedGuide,
} from '@/lib/offline-course-db'

/**
 * Descarga (y revalida) el contenido de un curso para leerlo sin conexión
 * (https://github.com/pasosdeJesus/learn.tg/issues/256).
 *
 * Reutiliza los endpoints que ya existen: `GET /api/guide` (el HTML que la
 * página de guía muestra y que `useCachedGuide` cachea) y `GET /api/crossword`
 * (cuadrícula y pistas, **sin respuestas**: celdas con `letter` vacío y
 * colocaciones con `word: '-'`). Un solo camino de lectura, online y offline.
 */

export interface CourseDescriptor {
  courseId: number
  lang: string
  /** Prefijo de ruta del curso tal como vive en la URL (`gdcluster`). */
  prefix: string
  titulo: string | null
  contenidoCristiano: boolean
  isPremium: boolean
  /** Sufijos de ruta de las guías, en orden (`guide1`, `guide2`, ...). */
  guides: string[]
}

export interface DownloadProgress {
  done: number
  total: number
  stage: 'guide' | 'puzzle'
}

export interface DownloadOptions {
  /** GET autenticado (`authedGet` de `useAuthedApi`). */
  get: <T = any>(url: string) => Promise<{ data: T }>
  wallet: string | null
  onProgress?: (progress: DownloadProgress) => void
}

interface GuideResponse {
  markdown?: string
  message?: string
}

interface PuzzleResponse {
  grid?: unknown
  placements?: unknown[]
}

/**
 * Calienta la caché del service worker con el documento de una guía.
 *
 * El service worker guarda las páginas `/(en|es)/*` con NetworkFirst (24 h), pero
 * solo las que se pidieron: sin esto, abrir sin conexión una guía que nunca se
 * visitó en línea cae en la página de respaldo `/offline` y la descarga completa
 * serviría de poco. La regla está indexada por URL, así que un `fetch` de la
 * página la deja en la caché igual que una navegación.
 *
 * Es best-effort: sin service worker (o si falla) la descarga sigue siendo útil
 * para las guías que el estudiante ya abrió con conexión.
 */
async function warmPageCache(url: string): Promise<void> {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return
  try {
    await fetch(url, { credentials: 'same-origin', redirect: 'follow' })
  } catch {
    // sin caché cálida; la guía se leerá solo si ya se visitó
  }
}

/**
 * Descarga el curso completo. Lanza si el servidor no entrega alguna guía, para
 * no guardar una copia a medias que parecería completa.
 */
export async function downloadCourse(
  descriptor: CourseDescriptor,
  options: DownloadOptions,
): Promise<DownloadedCourse> {
  const { get, wallet, onProgress } = options
  const key = courseKey(descriptor.lang, descriptor.prefix)
  const total = descriptor.guides.length * 2
  let done = 0

  const downloadedGuides: DownloadedGuide[] = []
  const contents: string[] = []

  onProgress?.({ done, total, stage: 'guide' })
  for (const suffix of descriptor.guides) {
    // Deja el documento de la guía en la caché del service worker para poder
    // abrirla sin conexión aunque nunca se haya visitado (ver `warmPageCache`).
    await warmPageCache(`/${descriptor.lang}/${descriptor.prefix.replace(/^\/+/, '')}/${suffix}`)

    const guideResponse = await get<GuideResponse>(
      `/api/guide?courseId=${descriptor.courseId}&lang=${descriptor.lang}` +
      `&prefix=${encodeURIComponent(descriptor.prefix)}&guide=${encodeURIComponent(suffix)}`,
    )
    const markdown = guideResponse.data?.markdown
    if (!markdown) {
      throw new Error(`Guide ${suffix} could not be downloaded`)
    }
    done++
    onProgress?.({ done, total, stage: 'guide' })

    let puzzle: DownloadedGuide['puzzle'] = null
    try {
      const puzzleResponse = await get<PuzzleResponse>(
        `/api/crossword?courseId=${descriptor.courseId}&lang=${descriptor.lang}` +
        `&prefix=${encodeURIComponent(descriptor.prefix)}&guide=${encodeURIComponent(suffix)}`,
      )
      if (Array.isArray(puzzleResponse.data?.grid) && Array.isArray(puzzleResponse.data?.placements)) {
        puzzle = {
          grid: puzzleResponse.data.grid,
          placements: puzzleResponse.data.placements,
        }
      }
    } catch {
      // Una guía sin crucigrama (o sin sesión) no impide descargar el curso.
      puzzle = null
    }
    done++
    onProgress?.({ done, total, stage: 'puzzle' })

    await saveCourseGuide(key, suffix, markdown)
    contents.push(markdown)
    downloadedGuides.push({ suffix, puzzle })
  }

  const course: DownloadedCourse = {
    key,
    courseId: descriptor.courseId,
    lang: descriptor.lang,
    prefix: descriptor.prefix.replace(/^\/+/, ''),
    titulo: descriptor.titulo,
    contenidoCristiano: descriptor.contenidoCristiano,
    isPremium: descriptor.isPremium,
    wallet: wallet ? wallet.toLowerCase() : null,
    downloadedAt: Date.now(),
    revision: computeRevision(contents),
    guides: downloadedGuides,
    bytes: approximateBytes(contents),
  }
  await saveDownloadedCourse(course)
  return course
}

/**
 * Revalida una copia al abrir la app con conexión (R-#256 §3.6). Descarga otra
 * vez y compara la revisión; devuelve si el servidor cambió el contenido. Si la
 * descarga falla (por ejemplo, se perdió el derecho al curso de pago), deja la
 * copia anterior intacta y lo informa.
 */
export async function revalidateCourse(
  descriptor: CourseDescriptor,
  options: DownloadOptions,
): Promise<{ updated: boolean; course: DownloadedCourse | null }> {
  const key = courseKey(descriptor.lang, descriptor.prefix)
  const previous = await getDownloadedCourse(key)
  try {
    const downloaded = await downloadCourse(descriptor, options)
    return { updated: previous ? previous.revision !== downloaded.revision : true, course: downloaded }
  } catch {
    return { updated: false, course: null }
  }
}
