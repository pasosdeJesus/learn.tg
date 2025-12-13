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

interface UseGuideDataProps {
  lang: string
  pathPrefix: string
  pathSuffix?: string
}

export function useGuideData({
  lang,
  pathPrefix,
  pathSuffix,
}: UseGuideDataProps) {
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
  const [percentageCompleted, setPercentageCompleted] = useState<number | null>(
    null,
  )
  const [percentagePaid, setPercentagePaid] = useState<number | null>(null)
  const [amountScholarship, setAmountScholarship] = useState<number | null>(null)

  useEffect(() => {
    const fetchGuideData = async () => {
      if (
        (session && !address) ||
        (address && !session) ||
        (address && session && session.address && address !== session.address)
      ) {
        setLoading(false)
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

        const detailResponse = await axios.get(detailUrl)
        const detailedCourse = detailResponse.data

        const guideStatusPromises = detailedCourse.guias.map((_: Guide, index: number) => {
          if (session && address && detailedCourse.id) {
            const statusUrl = `/api/guide-status?walletAddress=${address}&courseId=${detailedCourse.id}&guideNumber=${index + 1}`
            return axios.get(statusUrl)
          }
          return Promise.resolve({ data: { completed: false, receivedScholarship: false } })
        })

        const guideStatuses = await Promise.all(guideStatusPromises)

        const guidesWithStatus = detailedCourse.guias.map((guide: Guide, index: number) => ({
          ...guide,
          completed: guideStatuses[index].data.completed,
          receivedScholarship: guideStatuses[index].data.receivedScholarship,
        }))

        if (session && address && detailedCourse.id) {
          try {
            const scholarshipUrl = `/api/scholarship?courseId=${detailedCourse.id}&walletAddress=${address}&token=${csrfToken}`
            const scholarshipRes = await axios.get(scholarshipUrl)
            if (scholarshipRes.data.amountScholarship !== null) {
              setAmountScholarship(Number(scholarshipRes.data.amountScholarship))
            }
            
            const completedGuides = guidesWithStatus.filter((g: Guide) => g.completed).length
            const paidGuides = guidesWithStatus.filter((g: Guide) => g.receivedScholarship).length
            const totalGuides = guidesWithStatus.length

            if (totalGuides > 0) {
                setPercentageCompleted((completedGuides / totalGuides) * 100)
                setPercentagePaid((paidGuides / totalGuides) * 100)
            } else {
                setPercentageCompleted(0)
                setPercentagePaid(0)
            }

          } catch (err) {
            console.error('Error fetching scholarship amount:', err)
          }
        }

        const fullCourse: Course = {
          ...basicCourse,
          ...detailedCourse,
          guias: guidesWithStatus,
        }
        setCourse(fullCourse)

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
        console.error('Failed to fetch guide data:', e)
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }

    fetchGuideData()
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
    percentageCompleted,
    percentagePaid,
    amountScholarship,
  }
}

