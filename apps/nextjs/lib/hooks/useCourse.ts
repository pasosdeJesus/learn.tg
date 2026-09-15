'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { getApiToken } from '@/lib/auth-token'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import axios from 'axios'
import type { Course, Guide } from './guideTypes'

interface UseCourseProps {
  lang: string
  pathPrefix: string
}

export function useCourse({ lang, pathPrefix }: UseCourseProps) {
  const { address } = useAuthAddress()
  const { data: session } = useSession()

  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCourse = useCallback(async () => {
    if (
      address && session && session.address && address.toLowerCase() !== session.address.toLowerCase()
    ) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Sesión "fría" (bug #5719): usar el address de localStorage si la sesión
      // de NextAuth aún no expone `session.address`; si no, el fetch iría
      // anónimo y se perdería el avance del usuario.
      const wallet = address || session?.address || null
      // R-#227: token de API DEDICADO (el CSRF legacy queda solo como respaldo);
      // se usa en las rutas internas de Next (guide-status), no en Rails.
      const apiToken = await getApiToken()

      // R-#233 §4.4: public course list/detail served by Next directly from the
      // shared DB (same-origin, no Rails API, no token, no CORS). `walletAddress`
      // is only an untrusted hint for the sinBilletera/conBilletera filter.
      const listUrl = () => {
        let u =
          `/api/course-catalog?filtro[busprefijoRuta]=/${pathPrefix}&` +
          `filtro[busidioma]=${lang}`
        if (wallet) u += `&walletAddress=${wallet}`
        return u
      }

      const courseListResponse = await axios.get(listUrl())

      if (!courseListResponse.data || courseListResponse.data.length !== 1) {
        throw new Error('Course not found')
      }
      const basicCourse = courseListResponse.data[0]

      const detailResponse = await axios.get(`/api/course-catalog/${basicCourse.id}`)
      const detailedCourse = detailResponse.data

      const guideStatusPromises = detailedCourse.guias.map(async (_: Guide, index: number) => {
        if (wallet && detailedCourse.id) {
          // Token + sesión: guide-status acepta ambos, así que una cookie de
          // sesión ausente u obsoleta ya no deja la página en 401.
          const statusUrl = `/api/guide-status?walletAddress=${wallet}&courseId=${detailedCourse.id}&guideNumber=${index + 1}&token=${encodeURIComponent(apiToken || '')}`
          return axios.get(statusUrl).catch(() => ({
            data: { completed: false, receivedScholarship: false, receivedSlearnScholarship: false },
          }))
        }
        return Promise.resolve({ data: { completed: false, receivedScholarship: false, receivedSlearnScholarship: false } })
      })

      const guideStatuses = await Promise.all(guideStatusPromises)

      const guidesWithStatus = detailedCourse.guias.map((guide: Guide, index: number) => ({
        ...guide,
        completed: guideStatuses[index].data.completed,
        receivedScholarship: guideStatuses[index].data.receivedScholarship,
        receivedSlearnScholarship: guideStatuses[index].data.receivedSlearnScholarship,
      }))

      const fullCourse: Course = {
        ...basicCourse,
        ...detailedCourse,
        guias: guidesWithStatus,
      }
      setCourse(fullCourse)
    } catch (e: any) {
      console.error('Failed to fetch course data:', e)
      setError(e.message)
      setCourse(null)
    } finally {
      setLoading(false)
    }
  }, [session, address, lang, pathPrefix])

  useEffect(() => {
    fetchCourse()
  }, [fetchCourse])

  return { course, loading, error }
}
