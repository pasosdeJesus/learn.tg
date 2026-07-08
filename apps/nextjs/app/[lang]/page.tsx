'use client'

import axios from 'axios'
import { useSession, getCsrfToken } from 'next-auth/react'
import { use, useEffect, useState, useRef } from 'react'
import { useAccount } from 'wagmi'
import Image from 'next/image'

import { CourseStatistics } from '@/components/CourseStatistics'
import { CourseDonation } from '@/components/CourseDonation'
import { SlearnInfo, AddSlearnButton } from '@pasosdejesus/m/blockchain'
import { DonationSuccessAlert } from '@/components/DonationSuccessAlert'
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
  vaultBalanceSlearn: number
  amountPerGuide: number
  amountPerGuideSlearn: number
  canSubmit: boolean
  percentageCompleted: number
  percentagePaid: number
  profileScore: number
  totalGuides: number
  completedGuides: number
  paidGuidesUSDT: number
  paidGuidesSLEARN: number
  scholarshipPaidSlearn: number
}

export default function Page({ params }: PageProps) {
  const { address } = useAccount()
  const { data: session } = useSession()

  const [courses, setCourses] = useState<Course[]>([])
  const [extCourses, setExtCourses] = useState<Map<number, CourseExtra>>(
    new Map(),
  )
  const [donationIncrement, setDonationIncrement] = useState<number | null>(null)
  const [countdown, setCountdown] = useState(0)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownCourseRef = useRef(0)

  const startCountdownRefresh = (courseId: number) => {
    setCountdown(6)
    countdownCourseRef.current = courseId
    let n = 6
    if (countdownRef.current) clearInterval(countdownRef.current)
    countdownRef.current = setInterval(() => {
      n--
      if (n <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current)
        countdownRef.current = null
        setCountdown(0)
        refreshCourseVault(countdownCourseRef.current)
      } else {
        setCountdown(n)
      }
    }, 1000)
  }

  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current) }
  }, [])

  const parameters = use(params)
  const { lang } = parameters

  useEffect(() => {
    if (
      (session && !address) ||
      (address && !session) ||
      (address && session && session.address && address.toLowerCase() !== session.address.toLowerCase())
    ) {
      return
    }

    const configure = async () => {
      if (!process.env.NEXT_PUBLIC_API_BUSCA_CURSOS_URL) {
        alert('NEXT_PUBLIC_API_BUSCA_CURSOS_URL not defined')
        return
      }

      let url = `${process.env.NEXT_PUBLIC_API_BUSCA_CURSOS_URL}?filtro[busidioma]=${lang}`
      console.log('[courses] fetching:', url)
      let csrfToken = null

      if (session && address && session.address?.toLowerCase() === address.toLowerCase()) {
        csrfToken = await getCsrfToken()
        url += `&filtro[busconBilletera]=true&walletAddress=${session.address}&token=${csrfToken}`
      }

      try {
        const response = await axios.get<Course[]>(url)
        if (response.data) {
          const courseInfo = Array.isArray(response.data) ? response.data : (response.data as any).proyectosfinancieros || (response.data as any).data || []
          setCourses(courseInfo)

          if (!Array.isArray(courseInfo) || courseInfo.length === 0) return

          courseInfo.forEach(async (course: Course) => {
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
                vaultBalanceSlearn: +response2.data.vaultBalanceSlearn,
                amountPerGuide: +response2.data.amountPerGuide,
                amountPerGuideSlearn: +response2.data.amountPerGuideSlearn,
                canSubmit: response2.data.canSubmit,
                percentageCompleted: response2.data.percentageCompleted,
                percentagePaid: response2.data.percentagePaid,
                profileScore: response2.data.profileScore,
                totalGuides: response2.data.totalGuides,
                completedGuides: response2.data.completedGuides,
                paidGuidesUSDT: response2.data.paidGuidesUSDT ?? 0,
                paidGuidesSLEARN: response2.data.paidGuidesSLEARN ?? 0,
                scholarshipPaidSlearn: response2.data.amountScholarshipSlearn ?? 0,
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
        console.error('[courses] failed to fetch from:', url, error)
        alert('Failed to load courses. Check console.')
      }
    }

    configure()
  }, [session, address, lang])

  if (
    (session && !address) ||
    (address && !session) ||
    (address && session && session.address && address.toLowerCase() !== session.address.toLowerCase())
  ) {
    console.log('[courses] PARTIAL LOGIN — session:', !!session, 'address:', !!address, 'session.addr:', session?.address?.slice(0,10), 'wagmi.addr:', address?.slice(0,10), 'NEXTAUTH_URL:', process.env.NEXT_PUBLIC_AUTH_URL, 'NEXT_PUBLIC_API_BUSCA_CURSOS_URL:', process.env.NEXT_PUBLIC_API_BUSCA_CURSOS_URL)
    return (
      <div className="p-10 mt-10">
        Partial login. Please disconnect your wallet and connect and sign again.
      </div>
    )
  }

  const refreshCourseVault = async (courseId: number, data?: { increment?: number }) => {
    if (data?.increment) {
      setDonationIncrement(data.increment)
    }
    if (!session || !address || !session.address || session.address.toLowerCase() !== address.toLowerCase())
      return
    const csrfToken = await getCsrfToken()
    const url2 = `/api/scholarship?courseId=${courseId}&walletAddress=${session.address}&token=${csrfToken}`

    try {
      const response2 = await axios.get(url2)
      if (response2.data && !response2.data.message) {
        const extraData: CourseExtra = {
          vaultCreated: response2.data.vaultCreated,
          vaultBalance: +response2.data.vaultBalance,
          vaultBalanceSlearn: +response2.data.vaultBalanceSlearn,
          amountPerGuide: +response2.data.amountPerGuide,
          amountPerGuideSlearn: +response2.data.amountPerGuideSlearn,
          canSubmit: response2.data.canSubmit,
          percentageCompleted: response2.data.percentageCompleted,
          percentagePaid: response2.data.percentagePaid,
          profileScore: response2.data.profileScore,
          totalGuides: response2.data.totalGuides,
          completedGuides: response2.data.completedGuides,
          paidGuidesUSDT: response2.data.paidGuidesUSDT ?? 0,
          paidGuidesSLEARN: response2.data.paidGuidesSLEARN ?? 0,
          scholarshipPaidSlearn: response2.data.amountScholarshipSlearn ?? 0,
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
      {donationIncrement && (
        <DonationSuccessAlert
          increment={donationIncrement}
          lang={lang}
          onClose={() => setDonationIncrement(null)}
        />
      )}
      {countdown > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white border border-gray-200 shadow-lg rounded-lg px-6 py-3 text-sm text-gray-700 animate-pulse">
          {lang === 'es' ? `Actualizando en ${countdown}…` : `Refreshing in ${countdown}…`}
        </div>
      )}
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
                         scholarshipPerGuideSlearn={extra.amountPerGuideSlearn}
                         vaultBalance={extra.vaultBalance}
                         vaultBalanceSlearn={extra.vaultBalanceSlearn}
                         percentagePaid={extra.percentagePaid}
                         canSubmit={extra.canSubmit}
                         percentageCompleted={extra.percentageCompleted}
                         totalGuides={extra.totalGuides}
                         completedGuides={extra.completedGuides}
                         paidGuidesUSDT={extra.paidGuidesUSDT}
                         paidGuidesSLEARN={extra.paidGuidesSLEARN}
                         scholarshipPaidSlearn={extra.scholarshipPaidSlearn}
                      />
                    }
                  </footer>
                </a>
                {extra && extra.vaultCreated && (
                  <CourseDonation
                    lang={lang}
                    vaultBalance={extra.vaultBalance}
                    vaultBalanceSlearn={extra.vaultBalanceSlearn}
                    courseId={course.id}
                    isLoggedIn={!!session?.address}
                    onDonationSuccess={(courseId, data) => { refreshCourseVault(courseId, data); startCountdownRefresh(courseId) }}
                    showDonateButton={false}
                  />
                )}
              </article>
            )
          })}
        </div>
        <div className="mt-8 max-w-3xl mx-auto space-y-3">
          <SlearnInfo locale={lang} isVerified={!!session?.address}
            description={lang === 'es'
              ? 'Ganas becas en USDT + SLEARN al completar crucigramas, y 10% de vuelta en SLEARN al donar a cursos.'
              : 'You earn USDT + SLEARN scholarships by completing crosswords, and 10% back in SLEARN when you donate to courses.'}
            steps={lang === 'es'
              ? [
                  { title: '1. Aprendes', desc: 'Completa crucigramas en learn.tg — recibe becas en USDT + SLEARN', icon: 'earn' as const },
                  { title: '2. Donas', desc: 'Dona a la bóveda de un curso — recibe 10% de vuelta en SLEARN', icon: 'donate' as const },
                  { title: '3. Tomas cursos', desc: 'Usa SLEARN para pagar cursos premium en learn.tg', icon: 'course' as const },
                  { title: '4. Canjeas', desc: 'Completa un curso premium → obtén SBT → canjea SLEARN en stable-sl.pdJ.app por Leones (Sierra Leona) o USDT (todo el mundo)', icon: 'redeem' as const },
                ]
              : [
                  { title: '1. Learn', desc: 'Complete crosswords on learn.tg — get scholarships in USDT + SLEARN', icon: 'earn' as const },
                  { title: '2. Donate', desc: 'Donate to a course vault — earn 10% back in SLEARN', icon: 'donate' as const },
                  { title: '3. Take courses', desc: 'Use SLEARN to pay for premium courses on learn.tg', icon: 'course' as const },
                  { title: '4. Redeem', desc: 'Complete a premium course → get SBT → redeem SLEARN on stable-sl.pdJ.app for Leones (Sierra Leone) or USDT (worldwide)', icon: 'redeem' as const },
                ]}
            links={[
              { label: lang === 'es' ? 'Cursos en learn.tg' : 'Courses on learn.tg', href: process.env.NEXT_PUBLIC_NETWORK === 'celo' ? 'https://learn.tg' : 'https://learn.tg:9001' },
              { label: lang === 'es' ? 'Canjear en stable-sl' : 'Redeem on stable-sl', href: 'https://stable-sl.pdJ.app' },
            ]}
          />
          <p className="text-sm text-gray-500 text-center">
            {lang === 'es'
              ? '💡 En learn.tg también ganas USDT + SLEARN al completar crucigramas con becas.'
              : '💡 On learn.tg you also earn USDT + SLEARN by completing crosswords with scholarships.'}
          </p>
          <AddSlearnButton lang={lang} />
        </div>
      </div>
    </section>
  )
}
