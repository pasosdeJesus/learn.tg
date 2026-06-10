'use client'

import { use, useEffect, useState, useRef, useCallback } from 'react'
import { getCsrfToken, useSession } from 'next-auth/react'
import remarkDirective from 'remark-directive'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import { unified } from 'unified'
import { useAccount } from 'wagmi'
import { useMemo } from 'react'
import { createComponentT } from '@/lib/hooks/useTranslation'

import { CourseDonation } from '@/components/CourseDonation'
import { CourseStatistics } from '@/components/CourseStatistics'
import { DonationSuccessAlert } from '@/components/DonationSuccessAlert'
import { useGuideData } from '@/lib/hooks/useGuideData'
import { useScholarshipData } from '@/lib/hooks/useScholarshipData'

type PageProps = {
  params: Promise<{
    lang: string
    pathPrefix: string
  }>
}

export default function Page({ params }: PageProps) {
  const { address } = useAccount()
  const { data: session } = useSession()
  const parameters = use(params)
  const { lang, pathPrefix } = parameters
  const t = useMemo(() => createComponentT(lang, {"en":{"loading":"Loading course...","error":"Error: ","notFound":"Course not found."},"es":{"loading":"Cargando curso...","error":"Error: ","notFound":"Curso no encontrado."}}), [lang])
  const [csrfToken, setCsrfToken] = useState('')
  const [donationIncrement, setDonationIncrement] = useState<number | null>(null)
  const [countdown, setCountdown] = useState(0)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const {
    course,
    loading,
    error,
  } = useGuideData({
    lang,
    pathPrefix,
  })

  const sData = useScholarshipData({
    courseId: course?.id,
    address,
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

  useEffect(() => {
    if (address) {
      getCsrfToken().then((token) => {
        setCsrfToken(token || '')
      })
    } else {
      setCsrfToken('')
    }
  }, [address])

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

      let guias = "<ol class='list-decimal text-primary-foreground'>\n"
      for (const guia of course.guias) {
        guias += '<li>'
        if (guia.sufijoRuta) {
          guias +=
            `<a href='/${lang}/${pathPrefix}/${guia.sufijoRuta}' style='text-decoration: underline'>${guia.titulo}</a>`
          if (guia.completed) guias += ' ✅'
          if (guia.receivedScholarship) guias += ' 💵'
          if (guia.receivedSlearnScholarship) guias += ` <img src="/img/slearn-icon.svg" alt="SLEARN" style="width:1em;height:1em;display:inline;vertical-align:middle" />`
        } else {
          guias += guia.titulo
        }
        guias += '</li>\n'
      }
      guias += '</ol>\n'
      setContentsHtml(guias)
    }
  }, [course, lang, pathPrefix])

  if (
    (session && !address) ||
    (address && !session) ||
    (address && session && session.address && address.toLowerCase() !== session.address.toLowerCase())
  ) {
    return (
      <div className="p-10 mt-10">
        Partial login. Please disconnect your wallet and connect and sign again.
      </div>
    )
  }

  return (
    <>
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
      {loading && <div className="p-10 mt-10">{t('loading')}</div>}
      {error && <div className="p-10 mt-10">{t('error')}{error}</div>}
      {!loading && !error && course && (
        <div className="container mx-auto my-8 flex flex-col lg:flex-row justify-center gap-6 min-h-screen">
          <section className="flex flex-col items-center justify-center p-6 md:p-10 lg:p-12 lg:w-1/2 xl:w-3/5 bg-white rounded-2xl shadow">
            <header className="text-center mb-6">
              <h1 className="text-2xl lg:text-3xl font-bold mb-2">
                {course.titulo}
              </h1>
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
            {sData.vaultCreated && sData.vaultBalance !== null && (
              <CourseDonation
                lang={lang}
                vaultBalance={sData.vaultBalance}
                vaultBalanceSlearn={sData.vaultBalanceSlearn}
                courseId={parseInt(course.id)}
                isLoggedIn={!!session?.address}
                onDonationSuccess={(courseId, data) => {
                  fetchScholarship()
                  startCountdownRefresh()
                  if (data.increment) {
                    setDonationIncrement(data.increment)
                  }
                }}
              />
            )}
          </aside>
        </div>
      )}
      {!loading && !error && !course && (
        <div className="p-10 mt-10">{t('notFound')}</div>
      )}
    </>
  )
}
