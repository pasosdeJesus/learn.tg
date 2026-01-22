'use client'

import axios from 'axios'
import { useSession, getCsrfToken } from 'next-auth/react'
import { use, useEffect, useState } from 'react'
import { useAccount, usePublicClient } from 'wagmi'
import * as Toast from '@radix-ui/react-toast'
import Image from 'next/image'
import DonateModal from '@/components/DonateModal'
import { Button } from '@/components/ui/button'
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
}

export default function Page({ params }: PageProps) {
  const { address } = useAccount()
  const { data: session } = useSession()

  const [courses, setCourses] = useState<Course[]>([])
  const [extCourses, setExtCourses] = useState<Map<number, CourseExtra>>(
    new Map(),
  )
  const [donateCourseId, setDonateCourseId] = useState<number | null>(null)
  const [toastMsg, setToastMsg] = useState<string>('')
  const [toastOpen, setToastOpen] = useState<boolean>(false)

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
              console.log("OJO response2=", response2)
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
    if (!session || !address || !session.address || session.address !== address) return
    const csrfToken = await getCsrfToken()
    const url2 = `/api/scholarship?courseId=${courseId}&walletAddress=${session.address}&token=${csrfToken}`
    console.log("OJO url2=", url2)

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
        }
        console.log("OJO extraData=", extraData)
        setExtCourses((prevMap) =>
          new Map(prevMap.set(response2.data.courseId, extraData)),
        )
      }
    } catch (error) {
      console.error(error)
    }
  }

  const handleDonate = (courseId: number) => {
    setDonateCourseId(courseId)
  }

  const handleDonationSuccess = () => {
    setToastMsg(lang === 'es' ? 'Donación exitosa' : 'Donation successful')
    setToastOpen(true)
  }

  return (
    <Toast.Provider swipeDirection="right">
      <section aria-label="Courses grid" className="bg-gradient-to-br from-white via-gray-50 to-gray-100 py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
            {courses.map((course) => {
              const extra = extCourses.get(course.id)

              return (
                <article
                  key={course.id}
                  className="flex flex-col bg-white rounded-2xl shadow-md hover:shadow-xl overflow-hidden transform transition-all duration-300 hover:-translate-y-2 border border-gray-200"
                >
                  <a href={`/${course.idioma}${course.prefijoRuta}`} className="flex flex-col flex-grow">
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
                    <footer className="flex justify-between items-center p-4 mt-auto">
                      <div>
                        {extra && extra.amountPerGuide > 0 && (
                          <div className="p-2">
                            <span>
                              {lang === 'es' ? 'Beca de ' : 'Scholarship of '}$
                              {extra.amountPerGuide} USDT
                              {lang === 'es' ? ' por guía.' : ' per guide.'}
                            </span>
                          </div>
                        )}
                        {extra &&
                          extra.amountPerGuide > 0 &&
                          session?.address &&
                          extra.percentageCompleted < 100 &&
                          !extra.canSubmit && (
                            <div className="p-2">
                              <span className="text-red-500">
                                {lang === 'es'
                                  ? 'Aunque estás en etapa de enfriamiento'
                                  : 'Although you are in cooldown period.'}
                              </span>
                            </div>
                          )}
                        {extra &&
                          extra.amountPerGuide > 0 &&
                          extra.canSubmit &&
                          extra.percentageCompleted < 100 && (
                            <div className="p-2 text-green-600">
                              <span className="text-green-600">
                                {lang === 'es'
                                  ? 'Eres elegible.'
                                  : 'You are eligible.'}
                              </span>
                            </div>
                          )}
                      </div>
                      {extra && (
                        <CompletedProgress
                          percentageCompleted={extra.percentageCompleted || 0}
                          percentagePaid={extra.percentagePaid || 0}
                          lang={lang}
                        />
                      )}
                    </footer>
                  </a>
                  {extra && extra.vaultCreated && (
                    <div className="p-4 bg-green-100 flex items-center gap-3 justify-between">
                      <div className="text-sm text-green-800">
                        {lang === 'es' ? 'En bóveda: ' : 'In vault: '}$
                        {extra.vaultBalance} USDT
                      </div>
                      {session?.address && (
                        <Button
                          onClick={() => handleDonate(course.id)}
                          size="sm"
                        >
                          {lang === 'es' ? 'Donar a este curso' : 'Donate for this course'}
                        </Button>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </div>
        <DonateModal
          courseId={donateCourseId}
          isOpen={donateCourseId !== null}
          onClose={() => setDonateCourseId(null)}
          onSuccess={() => {
            if (donateCourseId) {
              refreshCourseVault(donateCourseId)
              handleDonationSuccess()
            }
          }}
          lang={lang}
        />
        <Toast.Root
          open={toastOpen}
          onOpenChange={setToastOpen}
          duration={5000}
          className="bg-primary text-primary-foreground rounded px-4 py-3 text-sm shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        >
          <Toast.Title className="font-bold">{toastMsg}</Toast.Title>
          <Toast.Close className="absolute top-1 right-2 text-primary-foreground/70 hover:text-primary-foreground">
            ×
          </Toast.Close>
        </Toast.Root>
        <Toast.Viewport className="fixed bottom-4 right-4 flex flex-col gap-2 w-96 max-w-[100vw] outline-none z-[60]" />
      </section>
    </Toast.Provider>
  )
}

