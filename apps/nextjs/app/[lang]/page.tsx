'use client'

import { useSession } from 'next-auth/react'
import { use, useEffect, useState } from 'react'
import Image from 'next/image'
import { useToast } from '@pasosdejesus/m/shadcn-components/ui/use-toast'
import { logger } from '@pasosdejesus/m/debug'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { useWalletProvider } from '@/lib/hooks/useWalletProvider'
import { useAuthedApi } from '@/lib/hooks/useAuthedApi'

import { CourseProgressCircles } from '@/components/CourseProgressCircles'
import { SlearnInfo, AddSlearnButton } from '@pasosdejesus/mpdj/blockchain'
import {
  saveCourseCatalog, getCourseCatalog, saveCourseExtras, getCourseExtras,
} from '@/lib/offline-catalog'
import { saveProfileScore } from '@/lib/offline-profile'
import { OfflineDownloadAll } from '@/components/OfflineDownloadAll'
import { CompletedProgress } from '@/components/ui/completed-progress'
import { useOfflineStatus } from '@/lib/hooks/useOfflineStatus'

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
  const { address } = useAuthAddress()
  // R-#254: con la billetera de la aplicación como proveedor efectivo, la
  // billetera ya lista CELO/USDT/SLEARN en su panel y no soporta
  // `wallet_watchAsset`, así que el botón "agregar SLEARN" del sitio no hacía nada.
  const { isInApp } = useWalletProvider()
  const { data: session, status: sessionStatus } = useSession()
  const { wallet, ready, authedGet } = useAuthedApi()
  const { toast } = useToast()
  const { isOffline } = useOfflineStatus()

  const [courses, setCourses] = useState<Course[]>([])
  const [extCourses, setExtCourses] = useState<Map<number, CourseExtra>>(
    new Map(),
  )

  const parameters = use(params)
  const { lang } = parameters

  useEffect(() => {
    if (courses.length > 0 && extCourses.size === courses.length) {
      saveCourseExtras(lang, extCourses)
    }
  }, [extCourses, courses, lang])

  useEffect(() => {
    if (
      address && session && session.address && address.toLowerCase() !== session.address.toLowerCase()
    ) {
      return
    }

    const configure = async () => {
      // Wait until the identity is resolved; never query anonymously while the
      // session is "cold" (#5719) — that produced the false "cooldown"/0%.
      if (!ready) return

      // R-#233 §4.4: public course list served by Next directly from the shared
      // DB. The standard hook adds the identity hint (`walletAddress`); there is
      // no token in the URL and no CORS.
      const listBaseUrl =
        `/api/course-catalog?filtro[busidioma]=${lang}` +
        (wallet ? `&filtro[busconBilletera]=true` : '')
      console.log('[courses] fetching:', listBaseUrl)

      // Global Disciples courses (gdcluster/redgd) are only shown to Christians
      // who explicitly declared a **non-Zionist** position (they do NOT support
      // Israel in the Gaza genocide): a Zionist or a user who has not answered the
      // question does not see the course at all (it is a course for non-Zionist
      // churches; the purchase gate is `canPurchaseGDCourse`).
      let gdVisible = false
      if (wallet) {
        try {
          const profileRes = await authedGet<{
            religion_id?: number
            profilescore?: number
            position_israel_gaza?: string | null
          }>('/api/profile')
          gdVisible =
            Number(profileRes.data?.religion_id) === 2 &&
            profileRes.data?.position_israel_gaza === 'no'
          // R-#242: último puntaje conocido, para poder avisar sin conexión.
          saveProfileScore(profileRes.data?.profilescore)
        } catch {
          gdVisible = false
        }
      }

      try {
        const response = await authedGet<Course[]>(listBaseUrl)
        if (response.data) {
          const courseInfo = (Array.isArray(response.data) ? response.data : (response.data as any).proyectosfinancieros || (response.data as any).data || [])
            // Global Disciples courses are only shown to eligible users (see above).
            .filter((c: Course) =>
              (c.prefijoRuta !== '/gdcluster' && c.prefijoRuta !== '/redgd') ||
              gdVisible,
            )
          console.log(courseInfo)
          setCourses(courseInfo)
          // R-#240 §4b: guardar la última lista vista para el menú sin conexión.
          saveCourseCatalog(lang, courseInfo)

          if (!Array.isArray(courseInfo) || courseInfo.length === 0) return

          courseInfo.forEach(async (course: Course) => {
            try {
              const response2 = await authedGet<any>(
                `/api/scholarship?courseId=${course.id}`,
              )
              if (response2.data.message) {
                console.error(
                  'Error message received:',
                  response2.data.message,
                )
                toast({ title: response2.data.message, variant: 'destructive' })
                return
              }

              const extraData: CourseExtra = {
                vaultCreated: response2.data.vaultCreated,
                vaultBalance: +response2.data.vaultBalance,
                vaultBalanceSlearn: +response2.data.vaultBalanceSlearn,
                amountPerGuide: +response2.data.amountPerGuide,
                amountPerGuideSlearn: +response2.data.amountPerGuideSlearn,
                canSubmit: response2.data.canSubmit,
                percentageCompleted: Number(response2.data.percentageCompleted) || 0,
                percentagePaid: Number(response2.data.percentagePaid) || 0,
                profileScore: Number(response2.data.profileScore) || 0,
                // Kysely `countAll` devuelve el conteo como cadena: convertir a
                // número para que los anillos comparen bien (como el detalle).
                totalGuides: Number(response2.data.totalGuides) || 0,
                completedGuides: Number(response2.data.completedGuides) || 0,
                paidGuidesUSDT: Number(response2.data.paidGuidesUSDT) || 0,
                paidGuidesSLEARN: Number(response2.data.paidGuidesSLEARN) || 0,
                scholarshipPaidSlearn: Number(response2.data.amountScholarshipSlearn) || 0,
              }

              setExtCourses((prevMap) =>
                new Map(prevMap.set(response2.data.courseId, extraData)),
              )
            } catch (error) {
              toast({ title: String(error), variant: 'destructive' })
              console.error(error)
            }
          })
        }
      } catch (error) {
        console.error('[courses] failed to fetch from:', listBaseUrl, error)
        logger.info('[courses] failed: ' + String(error) + ' | url: ' + listBaseUrl, 'Courses')
        // R-#240 §4b: sin conexión se muestra la última lista guardada en vez de
        // dejar la página vacía o en la de respaldo.
        const cached = getCourseCatalog<Course>(lang)
        if (cached && cached.courses.length > 0) {
          setCourses(
            cached.courses.filter((c: Course) =>
              (c.prefijoRuta !== '/gdcluster' && c.prefijoRuta !== '/redgd') || gdVisible,
            ),
          )
          const cachedExtras = getCourseExtras<CourseExtra>(lang)
          if (cachedExtras) setExtCourses(cachedExtras)
          toast({
            title: lang === 'es'
              ? 'Sin conexión: mostrando la lista de cursos guardada.'
              : 'You are offline: showing the saved course list.',
          })
        } else {
          toast({ title: 'Failed to load courses. Check console.', variant: 'destructive' })
        }
      }
    }

    configure()
  }, [ready, wallet, lang, authedGet])

  if (sessionStatus === 'loading') {
    return <div className="p-10 mt-10 text-center">Loading...</div>
  }

  if (
    address && session && session.address && address.toLowerCase() !== session.address.toLowerCase()
  ) {
    console.log('[courses] PARTIAL LOGIN — session:', !!session, 'address:', !!address, 'session.addr:', session?.address?.slice(0,10), 'wagmi.addr:', address?.slice(0,10), 'NEXTAUTH_URL:', process.env.NEXT_PUBLIC_AUTH_URL)
    return (
      <div className="p-10 mt-10">
        Partial login. Please disconnect your wallet and connect and sign again.
      </div>
    )
  }

  return (
    <section
      aria-label="Courses grid"
      className="bg-gradient-to-br from-white via-gray-50 to-gray-100 py-12 px-6"
    >
      <div className="max-w-6xl mx-auto">
        {/* R-#256: cuántos cursos están guardados en el teléfono y el botón para
            bajarlos todos con progreso (el operador reportó que no encontraba
            ninguna forma de descargar los cursos completos). La cuenta va en esta
            misma línea para no repetirla (operador, 2026-10-02). */}
        <OfflineDownloadAll lang={lang} totalCourses={courses.length} />
        <div className="grid gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
          {courses.map((course) => {
            const extra = extCourses.get(course.id)

            return (
              <article
                key={course.id}
                className="relative flex flex-col bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-200"
              >
                <a
                  href={`/${course.idioma}${course.prefijoRuta}`}
                  className="flex flex-col flex-grow"
                >
                  <figure className="img-course rounded-t-2xl overflow-hidden">
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
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {course.subtitulo}
                    </p>
                  </header>
                  {/* Botón "Ir al curso" (el span está dentro del <a> de la
                      tarjeta: toda la tarjeta navega al curso) */}
                  <div className="mt-auto px-5 pb-8">
                    <span className="block w-full rounded bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-blue-700">
                      {lang === 'es' ? 'Ir al curso' : 'Go to course'}
                    </span>
                  </div>
                </a>
                {extra && (
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 flex translate-y-1/2 justify-center">
                    <CourseProgressCircles
                      lang={lang}
                      offline={isOffline}
                      totalGuides={extra.totalGuides}
                      completedGuides={extra.completedGuides}
                      paidGuidesUSDT={extra.paidGuidesUSDT}
                      paidGuidesSLEARN={extra.paidGuidesSLEARN}
                      vaultBalance={extra.vaultBalance}
                      vaultBalanceSlearn={extra.vaultBalanceSlearn}
                      amountPerGuide={extra.amountPerGuide}
                      amountPerGuideSlearn={extra.amountPerGuideSlearn}
                    />
                  </div>
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
          {!isInApp && (
            <div className="mt-2">
              <AddSlearnButton lang={lang} />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
