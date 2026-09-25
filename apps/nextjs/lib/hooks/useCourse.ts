'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuthedApi } from '@/lib/hooks/useAuthedApi'
import { courseKey, getDownloadedCourse, type DownloadedCourse } from '@/lib/offline-course-db'
import type { Course, Guide } from './guideTypes'

interface UseCourseProps {
  lang: string
  pathPrefix: string
}

export function useCourse({ lang, pathPrefix }: UseCourseProps) {
  const { wallet, ready, mismatch, authedGet } = useAuthedApi()

  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // R-#256 §3.10: `true` cuando el curso se armó con la copia del dispositivo. La
  // página lo usa para decir que el avance es el de la descarga y para no ofrecer las
  // acciones que necesitan la red (donar, reclamar UBI).
  const [fromDevice, setFromDevice] = useState(false)
  const [downloadedAt, setDownloadedAt] = useState<number | null>(null)

  // R-#256: lo que ya está en pantalla no se borra si el dispositivo se queda sin
  // conexión y el effect vuelve a correr. Medido en E2E el 2026-09-24: al pasar a
  // offline la sesión cae, `useCourse` volvía a correr, no encontraba copia
  // descargada y vaciaba el curso, así que el crucigrama perdía la cuadrícula y el
  // botón de envío quedaba deshabilitado. Se recuerda en un ref porque `course` no
  // está en las dependencias de `fetchCourse`.
  const hasCourseRef = useRef(false)
  useEffect(() => { hasCourseRef.current = course !== null }, [course])

  const fetchCourse = useCallback(async () => {
    // Partial login (session vs localStorage mismatch): do not fetch.
    if (mismatch) {
      setLoading(false)
      return
    }
    // Wait until the identity is resolved: never fire an anonymous request while
    // the session is "cold" (#5719) — that produced the false "cooldown"/0%.
    if (!ready) return

    setLoading(true)
    setError(null)

    // R-#256 §3.7: el curso puede estar **descargado**. Se arma con el registro
    // guardado para que la página del curso y la de cada guía funcionen sin red
    // (el operador reportó el 2026-09-23 que offline no podía entrar a un curso ya
    // visitado, y la medición E2E del 2026-09-24 mostró que la guía descargada no
    // llegaba a pintarse).
    const loadFromDevice = async (cause?: unknown) => {
      const downloaded = await getDownloadedCourse(courseKey(lang, pathPrefix)).catch(() => null)
      if (downloaded) {
        setError(null)
        setCourse(courseFromDownloaded(downloaded))
        setFromDevice(true)
        setDownloadedAt(downloaded.downloadedAt)
        return
      }
      if (cause !== undefined) console.error('Failed to fetch course data:', cause)
      // Sin copia descargada: no se borra el curso que ya se está mostrando.
      if (hasCourseRef.current) return
      setFromDevice(false)
      setDownloadedAt(null)
      setError(cause instanceof Error ? cause.message : cause === undefined ? 'Offline' : String(cause))
      setCourse(null)
    }

    // Sin conexión no hay nada que pedir: el curso sale del dispositivo.
    // Se lee `navigator.onLine` (síncrono) y `useOfflineStatus` **no** entra en las
    // dependencias: si el dispositivo se queda sin conexión después de cargar,
    // volver a correr borraba el curso que ya estaba en pantalla y la página se
    // quedaba sin contenido (medido en E2E el 2026-09-24).
    const offline = typeof navigator !== 'undefined' && !navigator.onLine
    if (offline) {
      await loadFromDevice()
      setLoading(false)
      return
    }

    try {
      // R-#233 §4.4: public course list/detail served by Next directly from the
      // shared DB. The standard hook adds the identity hint (`walletAddress`);
      // there is no token in the URL.
      const courseListResponse = await authedGet<
        Array<{ id: string | number }>
      >(
        `/api/course-catalog?filtro[busprefijoRuta]=/${pathPrefix}` +
          `&filtro[busidioma]=${lang}`,
      )

      if (!courseListResponse.data || courseListResponse.data.length !== 1) {
        throw new Error('Course not found')
      }
      const basicCourse = courseListResponse.data[0]

      const detailResponse = await authedGet<TempCourseDetail>(
        `/api/course-catalog/${basicCourse.id}`,
      )
      const detailedCourse = detailResponse.data

      const guideStatusPromises = (detailedCourse.guias || []).map(
        async (_guide: Guide, index: number) => {
          if (wallet && detailedCourse.id) {
            return authedGet<GuideStatus>(
              `/api/guide-status?courseId=${detailedCourse.id}&guideNumber=${index + 1}`,
            ).catch(() => ({ data: emptyGuideStatus }))
          }
          return Promise.resolve({ data: emptyGuideStatus })
        },
      )

      const guideStatuses = await Promise.all(guideStatusPromises)

      const guidesWithStatus = (detailedCourse.guias || []).map(
        (guide: Guide, index: number) => ({
          ...guide,
          completed: guideStatuses[index].data.completed,
          receivedScholarship: guideStatuses[index].data.receivedScholarship,
          receivedSlearnScholarship: guideStatuses[index].data.receivedSlearnScholarship,
        }),
      )

      const fullCourse: Course = {
        ...(basicCourse as object),
        ...(detailedCourse as object),
        guias: guidesWithStatus,
      } as Course
      setCourse(fullCourse)
      setFromDevice(false)
      setDownloadedAt(null)
    } catch (e: unknown) {
      await loadFromDevice(e)
    } finally {
      setLoading(false)
    }
  }, [ready, mismatch, wallet, lang, pathPrefix, authedGet])

  useEffect(() => {
    fetchCourse()
  }, [fetchCourse])

  return { course, loading, error, fromDevice, downloadedAt }
}

/**
 * Curso a partir del registro descargado (R-#256): sin conexión la página del
 * curso debe listar **todas** las guías descargadas (no solo la visitada) y la
 * página de guía resolver su número y su ruta. La presentación (subtítulo y
 * resumen) y el avance de cada guía son los del **momento de la descarga**, para
 * que la página no sea un cascarón vacío sin conexión (§3.10).
 */
function courseFromDownloaded(downloaded: DownloadedCourse): Course {
  return {
    id: String(downloaded.courseId),
    titulo: downloaded.titulo || downloaded.prefix,
    subtitulo: downloaded.subtitulo ?? undefined,
    resumenMd: downloaded.resumenMd ?? undefined,
    idioma: downloaded.lang,
    prefijoRuta: `/${downloaded.prefix}`,
    guias: downloaded.guides.map((guide) => ({
      titulo: guide.suffix,
      sufijoRuta: guide.suffix,
      completed: guide.completed,
      receivedScholarship: guide.receivedScholarship,
      receivedSlearnScholarship: guide.receivedSlearnScholarship,
    })),
    conBilletera: false,
    sinBilletera: true,
    creditosMd: '',
    // `null` (no `undefined`) para los gratuitos: la pagina decide con
    // `Number(course.porPagar) <= 0` y `Number(undefined)` es `NaN`, asi que sin
    // conexion la copia descargada quedaba como "sin derecho a leer" y la pagina no
    // mostraba ni la presentacion ni el avance (medido en E2E el 2026-09-25).
    porPagar: downloaded.isPremium ? '1' : null,
    contenido_sensible: downloaded.contenidoSensible,
  } as Course
}

interface GuideStatus {
  completed: boolean
  receivedScholarship: boolean
  receivedSlearnScholarship: boolean
}

interface TempCourseDetail {
  id?: number
  guias?: Guide[]
}

const emptyGuideStatus: GuideStatus = {
  completed: false,
  receivedScholarship: false,
  receivedSlearnScholarship: false,
}
