'use client'

import { useEffect, useState } from 'react'
import { useSession, getCsrfToken } from 'next-auth/react'
import { useAccount } from 'wagmi'
import axios from 'axios'

export interface Guide {
  titulo: string
  sufijoRuta: string
  completed?: boolean
  receivedScholarship?: boolean
}

export interface Course {
  id: string
  titulo: string
  subtitulo?: string
  idioma: string
  prefijoRuta: string
  guias: Guide[]
  conBilletera: boolean
  sinBilletera: boolean
  creditosMd: string
  resumenMd?: string
  ampliaMd?: string
  imagen?: string
  altImagen?: string
  enlaceImagen?: string
  creditoImagen?: string
}

interface UseCourseDataProps {
  lang: string
  pathPrefix: string
  pathSuffix?: string
}

export function useCourseData({
  lang,
  pathPrefix,
  pathSuffix,
}: UseCourseDataProps) {
  const { address } = useAccount()
  const { data: session } = useSession()

  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [myGuide, setMyGuide] = useState<Guide | null>(null)
  const [guideNumber, setGuideNumber] = useState(0)
  const [nextGuidePath, setNextGuidePath] = useState('')
  const [previousGuidePath, setPreviousGuidePath] = useState('')
  const [coursePath, setCoursePath] = useState('')

  useEffect(() => {
    const fetchCourseData = async () => {
      if (
        (session && !address) ||
        (address && !session) ||
        (address && session && session.address && address !== session.address)
      ) {
        // Evita ejecutar la carga si la sesión no es consistente
        return
      }

      setLoading(true)
      setError(null)
      setCoursePath(`/${lang}/${pathPrefix}`)

      try {
        let url =
          `${process.env.NEXT_PUBLIC_API_BUSCA_CURSOS_URL}?` +
          `filtro[busprefijoRuta]=/${pathPrefix}&` +
          `filtro[busidioma]=${lang}`

        const csrfToken = await getCsrfToken()

        if (session && address && session.address === address) {
          url += `&walletAddress=${session.address}&token=${csrfToken}`
        }

        console.log(`useCourseData: Fetching ${url}`)
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

        if (session && address && session.address === address) {
          detailUrl += `&walletAddress=${session.address}&token=${csrfToken}`
        }

        console.log(`useCourseData: Fetching ${detailUrl}`)
        const detailResponse = await axios.get(detailUrl)
        const detailedCourse = detailResponse.data

        // Fetch guide statuses in parallel
        const guideStatusPromises = detailedCourse.guias.map((_: Guide, index: number) => {
          if (session && address && detailedCourse.id) {
            const statusUrl = `/api/guide-status?walletAddress=${address}&courseId=${detailedCourse.id}&guideNumber=${index + 1}`
            return axios.get(statusUrl)
          }
          return Promise.resolve({ data: { completed: false, receivedScholarship: false } })
        })

        const guideStatuses = await Promise.allSettled(guideStatusPromises)

        const guidesWithStatus = detailedCourse.guias.map((guide: Guide, index: number) => {
          const statusResult = guideStatuses[index]
          if (statusResult.status === 'fulfilled') {
            return {
              ...guide,
              completed: statusResult.value.data.completed,
              receivedScholarship: statusResult.value.data.receivedScholarship,
            }
          } else {
            // If guide-status API fails, treat as not completed and no scholarship
            console.warn(`Failed to fetch guide status for guide ${index + 1}:`, statusResult.reason)
            return {
              ...guide,
              completed: false,
              receivedScholarship: false,
            }
          }
        })

        const fullCourse: Course = {
          ...basicCourse,
          ...detailedCourse,
          guias: guidesWithStatus,
        }
        setCourse(fullCourse)

        // Logic for specific guide page
        if (pathSuffix) {
          const currentGuideIndex = fullCourse.guias.findIndex(
            (g: Guide) => g.sufijoRuta === pathSuffix,
          )

          if (currentGuideIndex !== -1) {
            const guideNum = currentGuideIndex + 1
            setGuideNumber(guideNum)
            setMyGuide(fullCourse.guias[currentGuideIndex])

            if (currentGuideIndex > 0) {
              const prevGuide = fullCourse.guias[currentGuideIndex - 1]
              setPreviousGuidePath(
                `/${lang}/${pathPrefix}/${prevGuide.sufijoRuta}`,
              )
            }
            if (currentGuideIndex < fullCourse.guias.length - 1) {
              const nextGuide = fullCourse.guias[currentGuideIndex + 1]
              setNextGuidePath(
                `/${lang}/${pathPrefix}/${nextGuide.sufijoRuta}`,
              )
            }
          }
        }
      } catch (e: any) {
        console.error('Failed to fetch course data:', e)
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }

    fetchCourseData()
  }, [session, address, lang, pathPrefix, pathSuffix])

  return {
    course,
    loading,
    error,
    myGuide,
    guideNumber,
    nextGuidePath,
    previousGuidePath,
    coursePath,
  }
}

