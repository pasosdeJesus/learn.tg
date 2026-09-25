'use client'

import { use, useEffect, useState, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import remarkDirective from 'remark-directive'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import { unified } from 'unified'
import { useMemo } from 'react'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { useAuthedApi } from '@/lib/hooks/useAuthedApi'
import { courseAccessReasonText } from '@/lib/course-access-msg'

import { CourseDonation } from '@/components/CourseDonation'
import { CourseStatistics } from '@/components/CourseStatistics'
import { CheckoutModal } from '@/components/CheckoutModal'
import { MaintenanceBanner } from '@/components/MaintenanceBanner'
import { OfflineCourseDownload } from '@/components/OfflineCourseDownload'
import { useGuideData } from '@/lib/hooks/useGuideData'
import { useScholarshipData } from '@/lib/hooks/useScholarshipData'

type PageProps = {
  params: Promise<{
    lang: string
    pathPrefix: string
  }>
}

export default function Page({ params }: PageProps) {
  const { address } = useAuthAddress()
  const { data: session, status: sessionStatus } = useSession()
  const { authedGet } = useAuthedApi()
  const parameters = use(params)
  const { lang, pathPrefix } = parameters
  const t = useMemo(() => createComponentT(lang, {"en":{"loading":"Loading course...","error":"Error: ","notFound":"Course not found."},"es":{"loading":"Cargando curso...","error":"Error: ","notFound":"Curso no encontrado."}}), [lang])
  const [countdown, setCountdown] = useState(0)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const {
    course,
    loading,
    error,
    // R-#256 §3.10: el curso vino de la copia del dispositivo (sin conexión).
    fromDevice,
    downloadedAt,
  } = useGuideData({
    lang,
    pathPrefix,
  })

  const sData = useScholarshipData({
    courseId: course?.id,
    address: address || session?.address,
  })
  const { fetchScholarship } = sData

  const startCountdownRefresh = useCallback(() => {
    setCountdown(6)
    let n = 6
    if (countdownRef.current) clearInterval(countdownRef.current)
    countdownRef.current = setInterval(() => {
      n--
      if (n <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current)
        countdownRef.current = null
        setCountdown(0)
        fetchScholarship()
      } else {
        setCountdown(n)
      }
    }, 1000)
  }, [fetchScholarship])

  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current) }
  }, [])

  useEffect(() => {
    if (course?.id && address) {
      fetchScholarship()
    }
  }, [course?.id, address, fetchScholarship])

  const [htmlSummary, setHtmlSummary] = useState('')
  const [htmlExtended, setHtmlExtended] = useState('')
  const [contentsHtml, setContentsHtml] = useState('')
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [hasPurchased, setHasPurchased] = useState(false)
  const [gdEligible, setGdEligible] = useState<boolean | null>(null)
  const [gdReason, setGdReason] = useState<string | null>(null)
  const [fundSlearn, setFundSlearn] = useState<string | null>(null)
  // Precio del curso premium, para mostrarlo junto al botón (§2.1 de
  // https://github.com/pasosdeJesus/learn.tg/issues/128): antes solo se veía
  // dentro del modal de compra.
  const [premiumPrice, setPremiumPrice] = useState<{ usdt: number; slearn: number } | null>(null)

  const isGd =
    course?.prefijoRuta === '/gdcluster' || course?.prefijoRuta === '/redgd'

  // Check whether the authenticated user already purchased this premium course.
  useEffect(() => {
    if (!course || !address || Number(course.porPagar) <= 0) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await authedGet<any>('/api/courses/premium/mine')
        if (cancelled) return
        const courses = res.data?.courses || []
        setHasPurchased(courses.some((c: any) => Number(c.course_id) === Number(course.id)))
      } catch {
        if (!cancelled) setHasPurchased(false)
      }
    })()
    return () => { cancelled = true }
  }, [course, address])

  // Premium courses: determine purchase eligibility so the Buy button is only
  // shown to eligible members (every paid course requires a verified worship
  // city; GD adds the pilot gates).
  useEffect(() => {
    if (!course || !address || Number(course.porPagar) <= 0) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await authedGet<any>(`/api/courses/${course.id}/purchase-eligibility`)
        if (cancelled) return
        setGdEligible(!!res.data?.eligible)
        setGdReason(res.data?.reason || null)
      } catch {
        if (!cancelled) {
          setGdEligible(false)
          setGdReason(null)
        }
      }
    })()
    return () => { cancelled = true }
  }, [course, address])

  // Precio (USDT y SLEARN con el 10% de descuento) para el botón de compra.
  useEffect(() => {
    if (!course || !address || Number(course.porPagar) <= 0 || hasPurchased) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await authedGet<any>(`/api/courses/premium/price?courseId=${course.id}`)
        if (cancelled) return
        setPremiumPrice({
          usdt: Number(res.data?.priceUSDT),
          slearn: Number(res.data?.priceSLEARN),
        })
      } catch {
        if (!cancelled) setPremiumPrice(null)
      }
    })()
    return () => { cancelled = true }
  }, [course, address, hasPurchased])

  // Global Disciples courses: show remaining churches fund (22 SLEARN pastor bonus).
  useEffect(() => {
    if (!isGd) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await authedGet<any>('/api/churches/fund')
        if (cancelled) return
        setFundSlearn(res.data?.slearnBalance ?? null)
      } catch {
        if (!cancelled) setFundSlearn(null)
      }
    })()
    return () => { cancelled = true }
  }, [isGd])

  const htmlDeMd = (md: string) => {
    if (!md) return ''
    const processor = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkDirective)
      .use(remarkFrontmatter)
      .use(remarkRehype)
      .use(rehypeStringify)
    return processor.processSync(md).toString()
  }

  useEffect(() => {
    if (course) {
      // @ts-ignore
      setHtmlSummary(htmlDeMd(course.resumenMd))
      // @ts-ignore
      setHtmlExtended(htmlDeMd(course.ampliaMd))

      // Numeración explícita dentro del texto: el reseteo de Tailwind pone
      // `list-style: none` y `padding: 0`, así que el marcador de un <ol> queda
      // fuera de la caja y el contenedor lo recorta (el operador reportó que no
      // se veía la numeración de las guías, 2026-09-16).
      let guias = "<ol class='list-none space-y-1 p-0 m-0 text-primary-foreground'>\n"
      let guideIndex = 0
      for (const guia of course.guias) {
        guideIndex += 1
        guias += `<li><span class="font-semibold">${guideIndex}.</span> `
        if (guia.sufijoRuta) {
          guias +=
            `<a href='/${lang}/${pathPrefix}/${guia.sufijoRuta}' style='text-decoration: underline'>${guia.titulo}</a>`
          if (guia.completed) guias += ' ✅'
          if (guia.receivedScholarship) guias += ' 💵'
          if (guia.receivedSlearnScholarship) guias += ` <img src="/img/slearn-icon.svg" alt="SLEARN" style="width:20px;height:20px;display:inline;vertical-align:middle" />`
        } else {
          guias += guia.titulo
        }
        guias += '</li>\n'
      }
      guias += '</ol>\n'
      setContentsHtml(guias)
    }
  }, [course, lang, pathPrefix])

  if (sessionStatus === 'loading') {
    return <div className="p-10 mt-10 text-center">Loading...</div>
  }

  if (
    address && session && session.address && address.toLowerCase() !== session.address.toLowerCase()
  ) {
    console.log('[course] PARTIAL LOGIN — session:', !!session, 'address:', !!address, 'session.addr:', session?.address?.slice(0,10), 'wagmi.addr:', address?.slice(0,10))
    return (
      <div className="p-10 mt-10">
        Partial login. Please disconnect your wallet and connect and sign again.
      </div>
    )
  }

  return (
    <>
      <MaintenanceBanner />
      {countdown > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white border border-gray-200 shadow-lg rounded-lg px-6 py-3 text-sm text-gray-700 animate-pulse">
          {lang === 'es' ? `Actualizando en ${countdown}…` : `Refreshing in ${countdown}…`}
        </div>
      )}
      {loading && <div className="p-10 mt-10">{t('loading')}</div>}
      {error && <div className="p-10 mt-10">{t('error')}{error}</div>}
      {!loading && !error && course && (
        <div className="container mx-auto my-8 flex flex-col lg:flex-row justify-center gap-6 min-h-screen">
          <section className="flex flex-col items-center justify-center p-6 md:p-10 lg:p-12 lg:w-1/2 xl:w-3/5 bg-white rounded-2xl shadow">
            <header className="text-center mb-6">
              <h1 className="text-2xl lg:text-3xl font-bold mb-2">
                {course.titulo}
              </h1>
              {Number(course.porPagar) > 0 && (
                <div className="flex flex-col items-center gap-2">
                  <span className="inline-block text-xs font-semibold uppercase tracking-wide bg-amber-100 text-amber-800 px-2 py-1 rounded">
                    {course.idioma === 'en' ? 'Premium course' : 'Curso premium'}
                  </span>
                  {fromDevice ? (
                    // Sin conexión no se puede volver a comprobar la compra: la copia
                    // descargada (con todas sus guías) es la prueba, así que no se
                    // ofrece un botón de compra que no puede funcionar (§3.10).
                    <span
                      className="inline-block rounded bg-green-100 px-4 py-1 text-sm font-semibold text-green-800"
                      data-testid="offline-purchased"
                    >
                      {course.idioma === 'en' ? 'Available offline' : 'Disponible sin conexión'}
                    </span>
                  ) : hasPurchased ? (
                    <span className="inline-block rounded bg-green-100 px-4 py-1 text-sm font-semibold text-green-800">
                      {course.idioma === 'en' ? 'Purchased' : 'Comprado'}
                    </span>
                  ) : gdEligible === false ? (
                    <span className="inline-block rounded bg-gray-100 px-4 py-1 text-sm font-semibold text-gray-600">
                      {courseAccessReasonText(gdReason, lang) ||
                        (course.idioma === 'en'
                          ? 'Not eligible for this course'
                          : 'No cumples los requisitos para este curso')}
                    </span>
                  ) : isGd && gdEligible === null ? null : (
                    <button
                      type="button"
                      onClick={() => setIsCheckoutOpen(true)}
                      className="inline-block rounded bg-primary px-4 py-1 text-sm font-semibold text-white hover:opacity-90"
                    >
                      {course.idioma === 'en' ? 'Buy this course' : 'Comprar este curso'}
                    </button>
                  )}
                  {!hasPurchased && gdEligible !== false && premiumPrice && premiumPrice.usdt > 0 && (
                    <span data-testid="premium-price" className="text-xs text-gray-600">
                      {premiumPrice.usdt.toFixed(2)} USDT
                      {premiumPrice.slearn > 0 && (
                        <>
                          {' · '}
                          {course.idioma === 'en'
                            ? `or ${premiumPrice.slearn.toFixed(2)} SLEARN (10% off)`
                            : `o ${premiumPrice.slearn.toFixed(2)} SLEARN (10% dto.)`}
                        </>
                      )}
                    </span>
                  )}
                </div>
              )}
              {/* @ts-ignore */}
              <h2 className="text-lg lg:text-xl font-semibold text-gray-600">
                {course.subtitulo}
              </h2>
            </header>

            <figure className="my-6">
              {/* @ts-ignore */}
              <img
                src={course.imagen}
                width="300"
                alt={course.altImagen}
                className="mx-auto rounded-lg shadow-md"
              />
              <figcaption className="text-sm text-gray-500 mt-3 text-center">
                {/* @ts-ignore */}
                <a
                  href={course.enlaceImagen}
                  target="_blank"
                  className="underline hover:text-secondary-600"
                >
                  {course.creditoImagen}
                </a>
              </figcaption>
            </figure>

            <article
              className="prose max-w-prose text-justify text-gray-700"
              dangerouslySetInnerHTML={{ __html: htmlSummary }}
            />
          </section>

          <aside className="flex flex-col gap-6 w-full lg:w-2/5">
            <div className="px-6 py-8 rounded-xl bg-white text-gray-800 shadow">
              <h2 className="text-2xl lg:text-3xl font-bold mb-6">
                {course.idioma === 'en'
                  ? 'Course contents'
                  : 'Contenido del curso'}
              </h2>
              <div
                className="list-decimal text-justify space-y-2"
                dangerouslySetInnerHTML={{ __html: contentsHtml }}
              />
            </div>

            <OfflineCourseDownload
              lang={lang}
              courseId={parseInt(course.id)}
              prefix={pathPrefix}
              titulo={course.titulo}
              subtitulo={course.subtitulo}
              resumenMd={course.resumenMd}
              guideStatus={Object.fromEntries(
                course.guias
                  .filter((guia) => guia.sufijoRuta)
                  .map((guia) => [
                    String(guia.sufijoRuta),
                    {
                      completed: guia.completed,
                      receivedScholarship: guia.receivedScholarship,
                      receivedSlearnScholarship: guia.receivedSlearnScholarship,
                    },
                  ]),
              )}
              contenidoSensible={course.contenido_sensible === true}
              isPremium={Number(course.porPagar) > 0}
              guides={course.guias.map((guia) => guia.sufijoRuta).filter(Boolean) as string[]}
              // El índice sin conexión muestra el título guardado, no `guide1`
              // (operador, 2026-09-25).
              guideTitles={Object.fromEntries(
                course.guias
                  .filter((guia) => guia.sufijoRuta)
                  .map((guia) => [String(guia.sufijoRuta), guia.titulo ?? null]),
              )}
              // Sin conexión la copia descargada ES la prueba de acceso: solo se guarda
              // si el curso se podía leer con esa billetera (`belongsToWallet` la
              // separa por dirección) y sin red no hay forma de volver a comprobarlo.
              // Con `canRead` en falso el panel no se pinta y la página del curso se
              // queda sin la presentación ni el avance guardados (§3.10).
              canRead={fromDevice || Number(course.porPagar) <= 0 || hasPurchased}
            />

            {isGd && fundSlearn !== null && (
              <div className="px-6 py-4 rounded-xl bg-white text-gray-800 shadow">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  {course.idioma === 'en'
                    ? 'Churches fund for pastor bonus'
                    : 'Fondo de iglesias para el bono de pastores'}
                </h3>
                <p className="text-sm text-gray-700">
                  {course.idioma === 'en' ? 'Available' : 'Disponible'}:{' '}
                  <span className="font-semibold">{fundSlearn} SLEARN</span>
                  {Number(fundSlearn) > 0 && (
                    <>
                      {' · '}
                      {course.idioma === 'en'
                        ? `funds ~${Math.floor(Number(fundSlearn) / 22)} more pastors`
                        : `financia ~${Math.floor(Number(fundSlearn) / 22)} pastores más`}
                    </>
                  )}
                </p>
              </div>
            )}

            {htmlExtended && (
              <div dangerouslySetInnerHTML={{ __html: htmlExtended }} />
            )}
            <CourseStatistics
              lang={lang}
              full={true}
              address={session?.address}
              totalGuides={course.guias.length}
              scholarshipPerGuide={sData.scholarshipPerGuide}
              scholarshipPerGuideSlearn={sData.scholarshipPerGuideSlearn}
              vaultBalance={sData.vaultBalance}
              vaultBalanceSlearn={sData.vaultBalanceSlearn}
              profileScore={sData.profileScore}
              canSubmit={sData.canSubmit}
              completedGuides={sData.completedGuides}
              paidGuides={sData.paidGuides}
          paidGuidesUSDT={sData.paidGuidesUSDT}
          paidGuidesSLEARN={sData.paidGuidesSLEARN}
              percentageCompleted={sData.percentageCompleted}
              percentagePaid={sData.percentagePaid}
              scholarshipPaid={sData.scholarshipPaid}
          scholarshipPaidSlearn={sData.scholarshipPaidSlearn}
            />
            {fromDevice ? (
              // R-#256 §3.10: sin conexión no se ofrecen las acciones que dependen de la
              // cadena (donar, reclamar UBI): se dice el motivo en una línea y vuelven
              // cuando hay red.
              <p
                className="px-6 py-4 rounded-xl bg-amber-50 text-sm text-amber-800"
                data-testid="offline-chain-actions"
              >
                {course?.idioma === 'es'
                  ? `Estás viendo la copia guardada: para donar o reclamar UBI necesitas conexión. El avance es el del ${downloadedAt ? new Date(downloadedAt).toLocaleDateString('es') : 'momento de la descarga'}.`
                  : `You are seeing the saved copy: donating or claiming UBI needs a connection. The progress shown is the one from ${downloadedAt ? new Date(downloadedAt).toLocaleDateString('en') : 'the download'}.`}
              </p>
            ) : (
              sData.vaultCreated && sData.vaultBalance !== null && (
                <CourseDonation
                  lang={lang}
                  vaultBalance={sData.vaultBalance}
                  vaultBalanceSlearn={sData.vaultBalanceSlearn}
                  courseId={parseInt(course.id)}
                  isLoggedIn={!!session?.address}
                  onDonationSuccess={(courseId) => {
                    fetchScholarship()
                    startCountdownRefresh()
                  }}
                />
              )
            )}
          </aside>
        </div>
      )}
      {!loading && !error && !course && (
        <div className="p-10 mt-10">{t('notFound')}</div>
      )}
      {course && (
        <CheckoutModal
          courseId={parseInt(course.id)}
          lang={lang}
          isOpen={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
          onSuccess={() => window.location.reload()}
        />
      )}
    </>
  )
}
