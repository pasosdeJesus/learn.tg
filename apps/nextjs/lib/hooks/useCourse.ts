'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession, getCsrfToken } from 'next-auth/react'
import { useAccount } from 'wagmi'
import axios from 'axios'
import type { Course, Guide } from './guideTypes'

interface UseCourseProps {
  lang: string
  pathPrefix: string
}

export function useCourse({ lang, pathPrefix }: UseCourseProps) {
  const { address } = useAccount()
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
      let url =
        `${process.env.NEXT_PUBLIC_API_BUSCA_CURSOS_URL}?` +
        `filtro[busprefijoRuta]=/${pathPrefix}&` +
        `filtro[busidioma]=${lang}`

      const csrfToken = await getCsrfToken()

      if (session && address && session.address?.toLowerCase() === address.toLowerCase()) {
        url += `&walletAddress=${session.address}&token=${csrfToken}`
      }

      const courseListResponse = await axios.get(url)

      if (!courseListResponse.data || courseListResponse.data.length !== 1) {
        throw new Error('Course not found')
      }
      const basicCourse = courseListResponse.data[0]

      if (!process.env.NEXT_PUBLIC_API_PRESENTA_CURSO_URL) {
        throw new Error('API presentation URL is not defined')
      }

      let detailUrl = process.env.NEXT_PUBLIC_API_PRESENTA_CURSO_URL.replace(
        'curso_id',
        basicCourse.id,
      )

      if (session && address && session.address?.toLowerCase() === address.toLowerCase()) {
        detailUrl += `&walletAddress=${session.address}&token=${csrfToken}`
      }

      const detailResponse = await axios.get(detailUrl)
      const detailedCourse = detailResponse.data

      const guideStatusPromises = detailedCourse.guias.map((_: Guide, index: number) => {
        if (session && address && detailedCourse.id) {
          const statusUrl = `/api/guide-status?walletAddress=${address}&courseId=${detailedCourse.id}&guideNumber=${index + 1}`
          return axios.get(statusUrl)
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
