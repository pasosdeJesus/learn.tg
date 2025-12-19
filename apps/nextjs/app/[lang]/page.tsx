'use client'

import axios from 'axios'
import { getCsrfToken, useSession } from 'next-auth/react'
import { use, useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
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
  percentageCompleted: number
  percentagePaid: number
  vaultCreated?: boolean
  vaultBalance?: number
  amountPerGuide?: number
  canSubmit?: boolean
}

export default function Page({ params }: PageProps) {
  const { address } = useAccount()
  const { data: session } = useSession()

  const [courses, setCourses] = useState<Course[]>([])
  const [donateCourseId, setDonateCourseId] = useState<number | null>(null)
  const [toastMsg, setToastMsg] = useState<string>('')
  const [toastOpen, setToastOpen] = useState<boolean>(false)

  const parameters = use(params)
  const { lang } = parameters

  const isPartialLogin = (session && !address) || (address && !session) || (address && session && session.address && address !== session.address);

  useEffect(() => {
    const fetchCoursesWithProgress = async () => {
      // Guard against running on partial login or when address is missing
      if (isPartialLogin || !address) {
        setCourses([])
        return
      }

      try {
        const url = `/api/courses-with-progress?lang=${lang}&walletAddress=${address}`
        const response = await axios.get<Course[]>(url)
        if (response.data) {
          setCourses(response.data)
        }
      } catch (error) {
        console.error('Error fetching courses with progress:', error)
        alert(
          error instanceof Error ? error.message : 'An unknown error occurred',
        )
      }
    }

    fetchCoursesWithProgress()
  }, [address, lang, isPartialLogin])

  const refreshCourseVault = async (courseId: number) => {
    if (!session || !address || session.address !== address) return
    const csrfToken = await getCsrfToken()
    const url = `/api/scholarship?courseId=${courseId}&walletAddress=${session.address}&token=${csrfToken}`

    try {
      const response = await axios.get(url)
      if (response.data && !response.data.message) {
        setCourses((prevCourses) =>
          prevCourses.map((course) => {
            if (course.id === courseId) {
              return {
                ...course,
                vaultCreated: response.data.vaultCreated,
                vaultBalance: +response.data.vaultBalance,
                amountPerGuide: +response.data.amountPerGuide,
                canSubmit: response.data.canSubmit,
                percentageCompleted: response.data.percentageCompleted,
                percentagePaid: response.data.percentagePaid,
              }
            }
            return course
          }),
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

  if (isPartialLogin) {
    return (
      <div className="p-10 mt-10">
        Partial login. Please disconnect your wallet and connect and sign again.
      </div>
    )
  }

  return (
    <Toast.Provider swipeDirection="right">
      <div className="bg-gradient-to-br from-white via-gray-50 to-gray-100 py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <div
                key={course.id}
                className="bg-white rounded-2xl shadow-md hover:shadow-xl overflow-hidden transform transition-all duration-300 hover:-translate-y-2 border border-gray-200 flex flex-col"
              >
                <a
                  href={`/${course.idioma}${course.prefijoRuta}`}
                  className="flex flex-col flex-grow"
                >
                  <div className="img-course">
                    {course.imagen && course.imagen.startsWith('/') && (
                      <Image
                        className="w-full h-[17rem] pt-2 object-cover"
                        src={course.imagen}
                        alt={course.titulo}
                        width={680}
                        height={272}
                      />
                    )}
                  </div>
                  <div className="p-5 flex-grow">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">
                      {course.titulo}
                    </h3>
                    <p className="text-sm text-gray-600 line-clamp-3">
                      {course.subtitulo}
                    </p>
                  </div>
                  <div className="flex justify-between items-center p-4">
                    <div>
                      {course.amountPerGuide !== undefined &&
                        course.amountPerGuide > 0 && (
                          <div className="p-2">
                            <span>
                              {lang === 'es' ? 'Beca de ' : 'Scholarship of '}$
                              {course.amountPerGuide} USDT
                              {lang === 'es' ? ' por guía.' : ' per guide.'}
                            </span>
                          </div>
                        )}
                      {course.amountPerGuide !== undefined &&
                        course.amountPerGuide > 0 &&
                        session?.address &&
                        course.percentageCompleted !== undefined &&
                        course.percentageCompleted < 100 &&
                        !course.canSubmit && (
                          <div className="p-2">
                            <span className="text-red-500">
                              {lang === 'es'
                                ? 'Aunque estás en etapa de enfriamiento'
                                : 'Although you are in cooldown period.'}
                            </span>
                          </div>
                        )}
                      {course.amountPerGuide !== undefined &&
                        course.amountPerGuide > 0 &&
                        course.canSubmit &&
                        course.percentageCompleted !== undefined &&
                        course.percentageCompleted < 100 && (
                          <div className="p-2 text-green-600">
                            <span className="text-green-600">
                              {lang === 'es'
                                ? 'Eres elegible.'
                                : 'You are eligible.'}
                            </span>
                          </div>
                        )}
                    </div>
                    {(course.percentageCompleted !== undefined ||
                      course.percentagePaid !== undefined) && (
                      <CompletedProgress
                        percentageCompleted={course.percentageCompleted || 0}
                        percentagePaid={course.percentagePaid || 0}
                        lang={lang}
                      />
                    )}
                  </div>
                </a>
                {course.vaultCreated && (
                  <div className="p-4 bg-green-100 flex items-center gap-3 justify-between mt-auto">
                    <div className="text-sm text-green-800">
                      {lang === 'es' ? 'En bóveda: ' : 'In vault: '}$
                      {course.vaultBalance} USDT
                    </div>
                    {session?.address && (
                      <Button
                        onClick={() => handleDonate(course.id)}
                        size="sm"
                      >
                        {lang === 'es'
                          ? 'Donar a este curso'
                          : 'Donate for this course'}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
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
      </div>
    </Toast.Provider>
  )
}
