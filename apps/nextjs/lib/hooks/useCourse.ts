'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuthedApi } from '@/lib/hooks/useAuthedApi'
import { courseKey, getDownloadedCourse } from '@/lib/offline-course-db'
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
    } catch (e: unknown) {
      // R-#256 §3.7: sin conexión el catálogo no responde, pero el curso puede
      // estar **descargado**. Se arma con el registro guardado para que la página
      // del curso y la de cada guía funcionen (el operador reportó el 2026-09-23
      // que offline no podía entrar a un curso ya visitado).
      const downloaded = await getDownloadedCourse(courseKey(lang, pathPrefix)).catch(() => null)
      if (downloaded) {
        setError(null)
        setCourse({
          id: String(downloaded.courseId),
          titulo: downloaded.titulo || downloaded.prefix,
          idioma: downloaded.lang,
          prefijoRuta: `/${downloaded.prefix}`,
          guias: downloaded.guides.map((guide) => ({ titulo: guide.suffix, sufijoRuta: guide.suffix })),
          conBilletera: false,
          sinBilletera: true,
          creditosMd: '',
          porPagar: downloaded.isPremium ? '1' : undefined,
          contenido_sensible: downloaded.contenidoSensible,
        } as Course)
      } else {
        console.error('Failed to fetch course data:', e)
        setError(e instanceof Error ? e.message : String(e))
        setCourse(null)
      }
    } finally {
      setLoading(false)
    }
  }, [ready, mismatch, wallet, lang, pathPrefix, authedGet])

  useEffect(() => {
    fetchCourse()
  }, [fetchCourse])

  return { course, loading, error }
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
