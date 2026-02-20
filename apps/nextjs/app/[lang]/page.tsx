'use client'

import axios from 'axios'
import { useSession, getCsrfToken } from 'next-auth/react'
import { use, useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import Image from 'next/image'

import { CourseStatistics } from '@/components/CourseStatistics'
import { CourseDonation } from '@/components/CourseDonation'
import { CompletedProgress } from '@/components/ui/completed-progress'

type PageProps = {
  params: Promise<{
    lang: string
  }>
}

interface Course {
  id: number
  idioma: string
  prefijoRuta: string
  imagen: string
  titulo: string
  subtitulo: string
}

interface CourseExtra {
  vaultCreated: boolean
  vaultBalance: number
  amountPerGuide: number
  canSubmit: boolean
  percentageCompleted: number
  percentagePaid: number
  profileScore: number
}

export default function Page({ params }: PageProps) {
  const { address } = useAccount()
  const { data: session } = useSession()

  const [courses, setCourses] = useState<Course[]>([])
  const [extCourses, setExtCourses] = useState<Map<number, CourseExtra>>(
    new Map(),
  )

  const parameters = use(params)
  const { lang } = parameters

  useEffect(() => {
    if (
      (session && !address) ||
      (address && !session) ||
      (address && session && session.address && address !== session.address)
    ) {
      return
    }

    const configure = async () => {
      if (!process.env.NEXT_PUBLIC_API_BUSCA_CURSOS_URL) {
        alert('NEXT_PUBLIC_API_BUSCA_CURSOS_URL not defined')
        return
      }

      let url = `${process.env.NEXT_PUBLIC_API_BUSCA_CURSOS_URL}?filtro[busidioma]=${lang}`
      let csrfToken = null

      if (session && address && session.address === address) {
        csrfToken = await getCsrfToken()
        url += `&filtro[busconBilletera]=true&walletAddress=${session.address}&token=${csrfToken}`
      }

      try {
        const response = await axios.get<Course[]>(url)
        if (response.data) {
          const courseInfo = response.data
          setCourses(courseInfo)

          courseInfo.forEach(async (course) => {
            let url2 = `/api/scholarship?courseId=${course.id}`
            if (csrfToken) {
              url2 += `&walletAddress=${session!.address}&token=${csrfToken}`
            }
            try {
              const response2 = await axios.get(url2)
              if (response2.data.message) {
                console.error(
                  'Error message received:',
                  response2.data.message,
                )
                alert(response2.data.message)
                return
              }

              const extraData: CourseExtra = {
                vaultCreated: response2.data.vaultCreated,
                vaultBalance: +response2.data.vaultBalance,
                amountPerGuide: +response2.data.amountPerGuide,
                canSubmit: response2.data.canSubmit,
                percentageCompleted: response2.data.percentageCompleted,
                percentagePaid: response2.data.percentagePaid,
                profileScore: response2.data.profileScore,
              }

              setExtCourses((prevMap) =>
                new Map(prevMap.set(response2.data.courseId, extraData)),
              )
            } catch (error) {
              alert(error)
              console.error(error)
            }
          })
        }
      } catch (error) {
        alert(error)
        console.error(error)
      }
    }

    configure()
  }, [session, address, lang])

  if (
    (session && !address) ||
    (address && !session) ||
    (address && session && session.address && address !== session.address)
  ) {
    return (
      <div className="p-10 mt-10">
        Partial login. Please disconnect your wallet and connect and sign again.
      </div>
    )
  }

  const refreshCourseVault = async (courseId: number) => {
    if (!session || !address || !session.address || session.address !== address)
      return
    const csrfToken = await getCsrfToken()
    const url2 = `/api/scholarship?courseId=${courseId}&walletAddress=${session.address}&token=${csrfToken}`

    try {
      const response2 = await axios.get(url2)
      if (response2.data && !response2.data.message) {
        const extraData: CourseExtra = {
          vaultCreated: response2.data.vaultCreated,
          vaultBalance: +response2.data.vaultBalance,
          amountPerGuide: +response2.data.amountPerGuide,
          canSubmit: response2.data.canSubmit,
          percentageCompleted: response2.data.percentageCompleted,
          percentagePaid: response2.data.percentagePaid,
          profileScore: response2.data.profileScore,
        }
        setExtCourses((prevMap) =>
          new Map(prevMap.set(response2.data.courseId, extraData)),
        )
      }
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <section
      aria-label="Courses grid"
      className="bg-gradient-to-br from-white via-gray-50 to-gray-100 py-12 px-6"
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
          {courses.map((course) => {
            const extra = extCourses.get(course.id)

            return (
              <article
                key={course.id}
                className="flex flex-col bg-white rounded-2xl shadow-md hover:shadow-xl overflow-hidden transition-all duration-300 border border-gray-200"
              >
                <a
                  href={`/${course.idioma}${course.prefijoRuta}`}
                  className="flex flex-col flex-grow"
                >
                  <figure className="img-course">
                    {course.imagen && course.imagen.startsWith('/') && (
                      <Image
                        className="w-full h-[17rem] pt-2 object-cover"
                        src={course.imagen}
                        alt={course.titulo}
                        width={680}
                        height={272}
                      />
                    )}
                  </figure>
                  <header className="p-5">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">
                      {course.titulo}
                    </h3>
                    <p className="text-sm text-gray-600 line-clamp-3">
                      {course.subtitulo}
                    </p>
                  </header>
                  <footer>
                    {extra && 
                       <CourseStatistics
                         lang={lang} 
                         full={false}
                         address={session?.address}
                         profileScore={extra.profileScore}
                         scholarshipPerGuide={extra.amountPerGuide}
                         percentagePaid={extra.percentagePaid}
                         canSubmit={extra.canSubmit}
                         percentageCompleted={extra.percentageCompleted}
                      />
                    }
                  </footer>
                </a>
                {extra && extra.vaultCreated && (
                  <CourseDonation
                    lang={lang}
                    vaultBalance={extra.vaultBalance}
                    courseId={course.id}
                    isLoggedIn={!!session?.address}
                    onDonationSuccess={refreshCourseVault}
                  />
                )}
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
