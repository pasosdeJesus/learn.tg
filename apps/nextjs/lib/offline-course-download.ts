'use client'

import {
  approximateBytes,
  computeRevision,
  courseKey,
  deleteDownloadedCourse,
  getDownloadedCourse,
  isStale,
  listDownloadedCourses,
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
  contenidoSensible: boolean
  isPremium: boolean
  /** Sufijos de ruta de las guías, en orden (`guide1`, `guide2`, ...). */
  guides: string[]
  /**
   * Título de cada guía por sufijo. Se guarda con la copia para que el índice sin
   * conexión muestre el título y no el sufijo de ruta (reporte del operador,
   * 2026-09-25). Un llamador que no lo conozca puede omitirlo.
   */
  guideTitles?: Record<string, string | null>
  /** R-#256 §3.10: presentación del curso (subtítulo y resumen) para que la copia
   * sin conexión no sea un cascarón vacío. */
  subtitulo?: string | null
  resumenMd?: string | null
  /** R-#256 §3.10: avance de cada guía al descargar, por sufijo. Un llamador que no
   * lo conozca (p. ej. la sincronización de la biblioteca) puede omitirlo. */
  guideStatus?: Record<string, {
    completed?: boolean
    receivedScholarship?: boolean
    receivedSlearnScholarship?: boolean
  }>
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
  onProgress?: (progress: DownloadProgress) => void}

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
 * Es best-effort: sin `caches` (o si falla) la descarga sigue siendo útil para las
 * guías que el estudiante ya abrió con conexión.
 */
/**
 * Caché de documentos de `next.config.ts` (`runtimeCaching`): si allí cambia el
 * nombre, cambia aquí (lo verifica `offline-course-download.test.ts`).
 */
export const PAGE_CACHE_NAME = 'learntg-pages'

async function warmPageCache(url: string): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const response = await fetch(url, { credentials: 'same-origin', redirect: 'follow' })
    if (!response.ok) return
    // Se guarda también a mano, sin depender de que el service worker controle la
    // página: en la primera visita (y en iOS/Safari, reporte del operador del
    // 2026-09-23) `navigator.serviceWorker.controller` es `null`, el `fetch` no
    // pasaba por el worker y la guía descargada caía en `/offline`. La regla de
    // `next.config.ts` lee esta misma caché por URL, así que la entrada manual
    // sirve igual que una navegación (y si el worker ya controla, no estorba).
    if ('caches' in window) {
      const cache = await caches.open(PAGE_CACHE_NAME)
      await cache.put(new Request(new URL(url, window.location.href).toString()), response)
    }
  } catch {
    // sin caché cálida; la guía se leerá solo si ya se visitó
  }
}

/**
 * Caché de imágenes de `next.config.ts` (`runtimeCaching`): si allí cambia el
 * nombre, cambia aquí (lo verifica `offline-course-download.test.ts`).
 */
export const IMAGE_CACHE_NAME = 'learntg-images'

/**
 * Imágenes que muestra una guía y que el service worker puede servir sin conexión:
 * las reglas de `next.config.ts` cubren `/img/…`, `/icons/…` y `/_next/image?…`.
 * Las externas (p. ej. las miniaturas de YouTube) quedan fuera: ninguna regla las
 * cachea.
 *
 * `GET /api/guide` entrega el contenido ya convertido a **HTML** (`<img src="…">`),
 * así que se leen los `<img>` y también la sintaxis Markdown, por si el servidor
 * llegara a entregarla sin convertir. El orden de los atributos no es fijo.
 */
export function guideImageUrls(guide: string): string[] {
  const urls = new Set<string>()
  const add = (url: string | undefined) => {
    if (!url) return
    const decoded = url.replace(/&amp;/g, '&')
    if (/^\/(img|icons)\/.*\.(png|jpg|jpeg|svg|webp|gif)$/i.test(decoded) || decoded.startsWith('/_next/image?')) {
      urls.add(decoded)
    }
  }

  for (const tag of guide.matchAll(/<img\b[^>]*>/gi)) {
    const src = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag[0])
    add(src?.[1] ?? src?.[2])
  }
  for (const match of guide.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)/g)) {
    add(match[1])
  }
  return [...urls]
}

/**
 * Deja una imagen de la guía en la misma caché que leen las reglas del service
 * worker, con el mismo truco que `warmPageCache` (guardar a mano, porque en la
 * primera visita la página puede no estar controlada por el worker). El operador
 * reportó el 2026-09-27 que la guía descargada se abría sin conexión pero **sin
 * sus figuras**: nunca se habían pedido, así que no estaban en ninguna caché.
 */
async function warmImageCache(url: string): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const response = await fetch(url, { credentials: 'same-origin' })
    if (!response.ok) return
    if ('caches' in window) {
      const cache = await caches.open(IMAGE_CACHE_NAME)
      await cache.put(new Request(new URL(url, window.location.href).toString()), response)
    }
  } catch {
    // sin la figura en caché: la guía se lee igual, solo falta esa imagen
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

  const coursePath = `/${descriptor.lang}/${descriptor.prefix.replace(/^\/+/, '')}`
  // La página del **curso** también se calienta: sin ella, abrir el curso sin
  // conexión caía en el respaldo `/offline` con la lista de cursos guardados en
  // vez de la presentación del curso y sus guías (reporte del operador,
  // 2026-09-27: `/en/a-relationship-with-Jesus` mostraba "You are offline").
  await warmPageCache(coursePath)

  onProgress?.({ done, total, stage: 'guide' })
  for (const suffix of descriptor.guides) {
    // Deja el documento de la guía en la caché del service worker para poder
    // abrirla sin conexión aunque nunca se haya visitado (ver `warmPageCache`).
    // Las dos páginas de la guía: la guía y su crucigrama. Sin la segunda, el
    // crucigrama descargado no abre sin conexión (el operador lo reportó el
    // 2026-09-23: la guía 3 con red apagada caía en "You are offline").
    const basePath = `${coursePath}/${suffix}`
    await warmPageCache(basePath)
    await warmPageCache(`${basePath}/test`)

    const guideResponse = await get<GuideResponse>(
      `/api/guide?courseId=${descriptor.courseId}&lang=${descriptor.lang}` +
      `&prefix=${encodeURIComponent(descriptor.prefix)}&guide=${encodeURIComponent(suffix)}`,
    )
    const markdown = guideResponse.data?.markdown
    if (!markdown) {
      throw new Error(`Guide ${suffix} could not be downloaded`)
    }
    // Las figuras de la guía se guardan con ella: sin esto la guía se abría sin
    // conexión pero sin sus imágenes (reporte del operador, 2026-09-27).
    for (const image of guideImageUrls(markdown)) {
      await warmImageCache(image)
    }
    done++
    onProgress?.({ done, total, stage: 'guide' })

    let puzzle: DownloadedGuide['puzzle'] = null
    try {
      const puzzleResponse = await get<PuzzleResponse>(
        `/api/crossword?courseId=${descriptor.courseId}&lang=${descriptor.lang}` +
        `&prefix=${encodeURIComponent(descriptor.prefix)}&guide=${encodeURIComponent(suffix)}`,
      )
      // R-#256: un crucigrama **con pistas** o ninguno. Sin sesión, `/api/crossword`
      // responde 200 con la cuadrícula vacía y "conecta tu billetera"; guardar eso
      // pintaba un crucigrama sin celdas al abrirlo sin conexión (medido 2026-09-24 en
      // el sitio de desarrollo). Con `puzzle: null` la página dice que no hay
      // crucigrama guardado, que es la verdad.
      const placements = puzzleResponse.data?.placements
      if (
        Array.isArray(puzzleResponse.data?.grid) &&
        Array.isArray(placements) &&
        placements.length > 0
      ) {
        puzzle = {
          grid: puzzleResponse.data.grid,
          placements,
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
    downloadedGuides.push({
      suffix,
      titulo: descriptor.guideTitles?.[suffix] ?? null,
      puzzle,
      ...(descriptor.guideStatus?.[suffix] ?? {}),
    })
  }

  const course: DownloadedCourse = {
    key,
    courseId: descriptor.courseId,
    lang: descriptor.lang,
    prefix: descriptor.prefix.replace(/^\/+/, ''),
    titulo: descriptor.titulo,
    subtitulo: descriptor.subtitulo ?? null,
    resumenMd: descriptor.resumenMd ?? null,
    contenidoSensible: descriptor.contenidoSensible,
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

/** Motivos por los que un curso no se descarga (se informan al usuario). */
export type SkipReason = 'privacy' | 'not-purchased' | 'already-current'

export interface SyncResult {
  downloaded: string[]
  skipped: { key: string; reason: SkipReason }[]
  failed: { key: string; error: string }[]
  /**
   * Copias que se borraron porque su curso ya no se presenta en el sitio
   * (desactivado o retirado del catálogo del idioma): R-#268.
   */
  removed: string[]
}

export interface AccessibleCourses {
  courses: CourseDescriptor[]
  skipped: { prefix: string; reason: SkipReason }[]
  total: number
  /**
   * Prefijos que trae el catálogo del idioma, tengan o no derecho de lectura.
   * `downloadAllAccessible` los usa para borrar la copia de un curso que ya no se
   * presenta (R-#268). Solo es confiable con sesión: el catálogo anónimo es otro
   * (`sinBilletera`).
   */
  catalogPrefixes: string[]
}

interface CatalogCourse {
  id: number
  prefijoRuta?: string | null
  idioma?: string | null
  titulo?: string | null
  porPagar?: string | number | null
  contenido_sensible?: boolean | null
  sinBilletera?: boolean | null
}

/**
 * Cursos que este estudiante puede leer (y que conviene tener sin conexión).
 *
 * Reglas, todas en el servidor y respetadas aquí:
 * - un curso **de contenido sensible** solo cuenta si el dueño encendió el
 *   interruptor de R-#259 (el teléfono no debe revelar la afiliación por sí solo);
 * - un curso **de pago** solo cuenta si esta billetera lo compró;
 * - el resto de cursos del catálogo del idioma, sí.
 *
 * Devuelve también los omitidos con su motivo, para poder decirlo en la interfaz.
 */
export async function listAccessibleCourses(
  get: DownloadOptions['get'],
  options: { lang: string; authenticated: boolean },
): Promise<AccessibleCourses> {
  const { lang, authenticated } = options
  const skipped: { prefix: string; reason: SkipReason }[] = []

  // El mismo filtro que la lista de cursos del sitio (`app/[lang]/page.tsx`): con
  // billetera conectada solo se presentan los cursos `conBilletera`. Sin ese filtro
  // el endpoint devolvía **todos** los cursos del idioma —incluidos los
  // desactivados, que tienen las dos banderas en falso y no se ven en el sitio— y
  // se descargaban (reporte del operador, 2026-09-27: `/offline` listaba
  // "GoodDollar", un curso desactivado).
  const catalogUrl =
    `/api/course-catalog?filtro[busidioma]=${encodeURIComponent(lang)}` +
    (authenticated ? '&filtro[busconBilletera]=true' : '')
  const catalog = await get<CatalogCourse[]>(catalogUrl)
  const catalogCourses: CatalogCourse[] = Array.isArray(catalog.data) ? catalog.data : []
  const catalogPrefixes = catalogCourses
    .map((course) => String(course.prefijoRuta || '').replace(/^\/+/, ''))
    .filter((prefix) => prefix.length > 0)
  if (catalogCourses.length === 0) return { courses: [], skipped, total: 0, catalogPrefixes: [] }

  let publicCourses = true
  let publicSensitiveCourses = false
  let purchased = new Set<number>()
  if (authenticated) {
    try {
      const settings = await get<{ publicCourses?: boolean; publicSensitiveCourses?: boolean }>('/api/settings')
      publicCourses = settings.data?.publicCourses !== false
      publicSensitiveCourses = settings.data?.publicSensitiveCourses === true
    } catch {
      // sin ajustes legibles se asume el default de R-#259 (no publicar contenido sensible)
    }
    try {
      const mine = await get<{ courses?: { course_id: number }[] }>('/api/courses/premium/mine')
      purchased = new Set((mine.data?.courses || []).map((c) => Number(c.course_id)))
    } catch {
      // sin la lista de compras, los cursos de pago quedan fuera (no se descargan)
    }
  }

  const courses: CourseDescriptor[] = []
  for (const course of catalogCourses) {
    const prefix = String(course.prefijoRuta || '').replace(/^\/+/, '')
    const courseId = Number(course.id)
    if (!prefix || !courseId) continue
    const isPremium = Number(course.porPagar || 0) > 0
    const contenidoSensible = course.contenido_sensible === true

    if (contenidoSensible && !(publicCourses && publicSensitiveCourses)) {
      skipped.push({ prefix, reason: 'privacy' })
      continue
    }
    if (isPremium && !purchased.has(courseId)) {
      skipped.push({ prefix, reason: 'not-purchased' })
      continue
    }

    try {
      const detail = await get<{ guias?: { sufijoRuta?: string; titulo?: string | null }[] }>(`/api/course-catalog/${courseId}`)
      const detailGuides = detail.data?.guias || []
      const guides = detailGuides
        .map((guide) => String(guide.sufijoRuta || ''))
        .filter((suffix) => suffix.length > 0)
      if (guides.length === 0) continue
      // Título por sufijo: sin conexión el índice del curso y el de `/offline` deben
      // mostrar el título de la guía, no su sufijo de ruta (operador, 2026-09-25).
      const guideTitles: Record<string, string | null> = {}
      for (const guide of detailGuides) {
        const suffix = String(guide.sufijoRuta || '')
        if (suffix) guideTitles[suffix] = guide.titulo ?? null
      }
      courses.push({
        courseId,
        lang: String(course.idioma || lang),
        prefix,
        titulo: course.titulo ?? null,
        contenidoSensible,
        isPremium,
        guides,
        guideTitles,
      })
    } catch {
      // un curso que no se puede leer (detalle no disponible) simplemente no entra
    }
  }

  return { courses, skipped, total: catalogCourses.length, catalogPrefixes }
}

/**
 * Borra las copias de cursos que ya no se presentan en el sitio: un curso
 * desactivado (o retirado del catálogo del idioma) no debe seguir en la biblioteca
 * sin conexión (reporte del operador, 2026-09-27: `/offline` seguía listando
 * "GoodDollar", un curso desactivado que ya no se ve en `/en/`).
 *
 * Solo se borra por **ausencia en el catálogo**, nunca por falta de derecho: un
 * curso de pago no comprado o de contenido sensible con el interruptor apagado sí
 * llega en la lista (con su motivo), así que su copia no se toca aquí.
 */
export async function pruneUnavailableCourses(
  lang: string,
  catalogPrefixes: string[],
): Promise<string[]> {
  const available = new Set(catalogPrefixes)
  const deleted: string[] = []
  for (const course of await listDownloadedCourses()) {
    if (course.lang !== lang) continue
    if (available.has(course.prefix)) continue
    await deleteDownloadedCourse(course.key)
    deleted.push(course.key)
  }
  return deleted
}

/**
 * Descarga **todos** los cursos a los que el estudiante tiene acceso, para que
 * ninguna guía accesible falte sin conexión (pedido del operador, 2026-09-23).
 *
 * Es idempotente y barato de repetir: si la copia ya está al día (misma lista de
 * guías y sin caducar) se omite, así que puede correr sola cada vez que la app
 * abre con conexión. Un fallo en un curso no detiene los demás.
 */
export async function downloadAllAccessible(
  get: DownloadOptions['get'],
  options: {
    lang: string
    wallet: string | null
    authenticated: boolean
    onProgress?: (progress: { done: number; total: number; label: string }) => void
    /**
     * Se llama antes de descargar: cuántos cursos hay, cuántos **faltan** (los que no
     * están al día) y cuántos pasos (guías y crucigramas) hay que traer. El aviso de
     * progreso solo aparece si `pending > 0`, para no interrumpir a quien ya lo tiene
     * todo guardado.
     */
    onStart?: (info: { total: number; pending: number; steps: number }) => void
  },
): Promise<SyncResult> {
  const { lang, wallet, authenticated, onProgress, onStart } = options
  const result: SyncResult = { downloaded: [], skipped: [], failed: [], removed: [] }

  const { courses, catalogPrefixes } = await listAccessibleCourses(get, { lang, authenticated })

  // Un curso desactivado ya no se presenta en el sitio: su copia tampoco queda en
  // la biblioteca sin conexión (R-#268). Sin sesión no se borra nada: el catálogo
  // anónimo es otro (`sinBilletera`) y no hay con qué comparar. Un catálogo vacío
  // (o ilegible) tampoco borra: sin prefijos no hay nada que comparar.
  if (authenticated && catalogPrefixes.length > 0) {
    result.removed = await pruneUnavailableCourses(lang, catalogPrefixes)
  }

  const pending: typeof courses = []
  for (const descriptor of courses) {
    const key = courseKey(descriptor.lang, descriptor.prefix)
    const previous = await getDownloadedCourse(key)
    const sameGuides = previous?.guides.map((guide) => guide.suffix).join(',') === descriptor.guides.join(',')
    // Una copia sin títulos (descargada antes de que se guardaran, 2026-09-25) se
    // refresca sola: si no, el índice seguiría mostrando `guide1` en vez del título.
    const titlesKnown = !descriptor.guideTitles || previous?.guides.every(
      (guide) => (guide.titulo ?? null) === (descriptor.guideTitles?.[guide.suffix] ?? null),
    )
    if (previous && sameGuides && titlesKnown && !isStale(previous)) continue
    pending.push(descriptor)
  }
  // El contador que ve el estudiante es de **pasos** (una guía y su crucigrama),
  // no de cursos: es lo que pidió el operador ("1/60 … 60/60", 2026-09-23).
  const steps = pending.reduce((sum, descriptor) => sum + descriptor.guides.length * 2, 0)
  onStart?.({ total: courses.length, pending: pending.length, steps })

  let stepsDone = 0
  for (const descriptor of courses) {
    const key = courseKey(descriptor.lang, descriptor.prefix)
    if (!pending.includes(descriptor)) {
      result.skipped.push({ key, reason: 'already-current' })
      continue
    }
    const base = stepsDone
    try {
      await downloadCourse(descriptor, {
        get,
        wallet,
        onProgress: (progress) => {
          onProgress?.({ done: base + progress.done, total: steps, label: descriptor.prefix })
        },
      })
      result.downloaded.push(key)
    } catch (error) {
      result.failed.push({ key, error: error instanceof Error ? error.message : String(error) })
    }
    stepsDone += descriptor.guides.length * 2
    onProgress?.({ done: stepsDone, total: steps, label: descriptor.prefix })
  }
  return result
}
