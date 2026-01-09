'use client'

import { use, useEffect, useState } from 'react'
import { useSession, getCsrfToken } from 'next-auth/react'
import { useAccount } from 'wagmi'

import { useGuideData } from '@/lib/hooks/useGuideData'

import { CompletedProgress } from '@/components/ui/completed-progress'
import remarkDirective from 'remark-directive'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import { unified } from 'unified'
import { formatUnits } from 'viem'

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
  const [csrfToken, setCsrfToken] = useState('')

  const { course, loading, error, percentageCompleted, percentagePaid, amountScholarship } = useGuideData({
    lang,
    pathPrefix,
  })

  const [htmlSummary, setHtmlSummary] = useState('')
  const [htmlExtended, setHtmlExtended] = useState('')
  const [contentsHtml, setContentsHtml] = useState('')

  // Get CSRF token when address is available
  useEffect(() => {
    if (address) {
      getCsrfToken().then(token => {
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
          guias += `<a href='/${lang}/${pathPrefix}/${guia.sufijoRuta}' style='text-decoration: underline'>${guia.titulo}</a>`
          if (guia.completed) guias += ' ✅'
          if (guia.receivedScholarship) guias += ' 💰'
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
    (address && session && session.address && address !== session.address)
  ) {
    return (
      <div className="p-10 mt-10">
        Partial login. Please disconnect your wallet and connect and sign again.
      </div>
    )
  }

  if (loading) {
    return <div className="p-10 mt-10">Loading course...</div>
  }

  if (error) {
    return <div className="p-10 mt-10">Error: {error}</div>
  }

  if (!course) {
    return <div className="p-10 mt-10">Course not found.</div>
  }

  return (
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
          <div className="mt-4 flex items-center justify-center gap-6">
            <CompletedProgress percentageCompleted={percentageCompleted || 0} percentagePaid={percentagePaid || 0} lang={lang} />
            <div className="flex flex-col gap-1">
              <div className="text-sm text-gray-600">
                {lang === 'es' ? 'Total de guias en el curso: ' : 'Total number of guides in the course: '}
                {course.guias.length}
              </div>
              <div className="text-sm text-gray-600">
                {lang === 'es' ? 'Total de guías aprobadas: ' : 'Total number of approved guides: '}
                {course.guias.filter(g => g.completed).length}
              </div>
              <div className="text-sm text-gray-600 font-medium">
                {lang === 'es' ? 'Total en USDT ganado: ' : 'Total USDT earned: '}
                ${formatUnits(BigInt(amountScholarship || 0), 6)} USDT
              </div>
            </div>
          </div>
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
            {course.idioma === 'en' ? 'Course contents' : 'Contenido del curso'}
          </h2>
          <div
            className="list-decimal text-justify space-y-2"
            dangerouslySetInnerHTML={{ __html: contentsHtml }}
          />
        </div>

        {htmlExtended && (
          <div dangerouslySetInnerHTML={{ __html: htmlExtended }} />
        )}
      </aside>
    </div>
  )
}
