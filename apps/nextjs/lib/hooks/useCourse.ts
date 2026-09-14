'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { getApiToken, refreshApiToken } from '@/lib/auth-token'
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
      // R-#227: token de API DEDICADO (el CSRF legacy queda solo como respaldo).
      let apiToken = await getApiToken()

      const listUrl = (token: string | null) => {
        let u =
          `${process.env.NEXT_PUBLIC_API_BUSCA_CURSOS_URL}?` +
          `filtro[busprefijoRuta]=/${pathPrefix}&` +
          `filtro[busidioma]=${lang}`
        if (wallet && token) u += `&walletAddress=${wallet}&token=${token}`
        return u
      }

      // Si el token guardado está obsoleto (401) pero la cookie de sesión sigue
      // válida, se pide uno dedicado nuevo y se reintenta — sin degradar a
      // consulta anónima con una billetera conectada.
      const getWithTokenRefresh = async (buildUrl: (token: string | null) => string) => {
        try {
          return await axios.get(buildUrl(apiToken))
        } catch (e: any) {
          if (e?.response?.status !== 401 || !wallet) throw e
          const fresh = await refreshApiToken()
          if (!fresh || fresh === apiToken) throw e
          apiToken = fresh
          return await axios.get(buildUrl(fresh))
        }
      }

      const courseListResponse = await getWithTokenRefresh(listUrl)

      if (!courseListResponse.data || courseListResponse.data.length !== 1) {
        throw new Error('Course not found')
      }
      const basicCourse = courseListResponse.data[0]

      if (!process.env.NEXT_PUBLIC_API_PRESENTA_CURSO_URL) {
        throw new Error('API presentation URL is not defined')
      }

      const detailUrl = (token: string | null) => {
        let d = process.env.NEXT_PUBLIC_API_PRESENTA_CURSO_URL!.replace(
          'curso_id',
          basicCourse.id,
        )
        if (wallet && token) d += `&walletAddress=${wallet}&token=${token}`
        return d
      }

      const detailResponse = await getWithTokenRefresh(detailUrl)
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
