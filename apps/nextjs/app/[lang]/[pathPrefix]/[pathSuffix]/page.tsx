'use client'

import axios, { AxiosError } from 'axios'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { use, useEffect, useState, useCallback } from 'react'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkDirective from 'remark-directive'
import remarkFrontmatter from 'remark-frontmatter'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import { unified } from 'unified'
import { useAccount } from 'wagmi'

import GoodDollarClaimButton from '@/components/GoodDollarClaimButton'
import { Button } from '@/components/ui/button'
import { useGuideData } from '@/lib/hooks/useGuideData'
import { remarkFillInTheBlank } from '@/lib/remarkFillInTheBlank.mjs'

type PageProps = {
  params: Promise<{
    lang: string
    pathPrefix: string
    pathSuffix: string
  }>
}

export default function Page({ params }: PageProps) {
  const { address } = useAccount()
  const { data: session } = useSession()
  const parameters = use(params)
  const { lang, pathPrefix, pathSuffix } = parameters

  const { 
    course, 
    loading, 
    error, 
    myGuide, 
    guideNumber, 
    nextGuidePath, 
    previousGuidePath, 
    coursePath 
  } = useGuideData({
    lang,
    pathPrefix,
    pathSuffix,
  })

  const [guideHtml, setGuideHtml] = useState('')
  const [creditsHtml, setCreditsHtml] = useState('')
  const [isClient, setIsClient] = useState(false)

  const htmlDeMd = useCallback((md: string) => {
    if (!md) return ''
    const processor = (unified() as any)
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkDirective)
      .use(remarkFrontmatter)
      .use(remarkFillInTheBlank, { url: `${pathSuffix}/test` })
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeStringify, { allowDangerousHtml: true })
    const html = processor.processSync(md).toString()

    if (typeof window !== 'undefined') {
      localStorage.setItem(
        'fillInTheBlank',
        JSON.stringify(
          (window as Window & { fillInTheBlank?: [] }).fillInTheBlank || [],
        ),
      )
    }

    const html_con_tailwind = html
      .replaceAll('<a href', '<a class="underline" href')
      .replaceAll('<blockquote>', '<blockquote class="ml-8 pt-2">')
      .replaceAll('<code>', '<code class="bg-gray-200">')
      .replaceAll('<h1>', '<h1 class="pt-6 pb-2 font-bold text-[1.9rem]">')
      .replaceAll('<h2>', '<h2 class="pt-6 pb-2 font-bold text-[1.7rem]">')
      .replaceAll('<h3>', '<h2 class="pt-6 pb-2 font-bold text-[1.5rem]">')
      .replace(/(<img [^>]*)>/g, '$1 class="pb-2">')
      .replace(/(<img [^>]*><\/p>\n)<p>/g, '$1<p class="flex justify-end">')
      .replace(/(<ol[^>]*)>/g, '$1 class="block list-decimal ml-8">')
      .replaceAll('<p><img', '<p class="pt-4 flex justify-center">' + '<img')
      .replace(
        /<p><a([^>]*youtube.com\/watch[^>]*)><img/g,
        '<p class="pt-4 pb-4 flex justify-center"><a target="_blank" $1><img',
      )
      .replace(
        /<p><a[^>]*("https:\/\/www.youtube.com\/embed[^"]*")><img[^>]*><\/a><\/p>/g,
        '<p class="pt-4 pb-4 flex justify-center">' +
          '<iframe width="560" height="315" ' +
          'src=$1 title="Reproductor de video de YouTube" frameborder="0" ' +
          'allow="accelerometer; autoplay; clipboard-write; encrypted-media; ' +
          'gyroscope; picture-in-picture; web-share" ' +
          'referrerpolicy="strict-origin-when-cross-origin" ' +
          'allowfullscreen></iframe>' +
          '</p',
      )
      .replaceAll('<li><p>([^<]*)</p></li>', '<li>$1</li>')
      .replaceAll('<p>', '<p class="pt-2 pb-2">')
      .replaceAll('<ul>', '<ul class="block list-disc ml-8">')

    return html_con_tailwind
  }, [pathSuffix])

  useEffect(() => {
    setIsClient(true)
    if (course && guideNumber > 0) {
        const fetchGuideContent = async () => {
            try {
                const nurl = `${process.env.NEXT_PUBLIC_AUTH_URL}/api/guide?courseId=${course.id}` +
                    `&lang=${lang}&prefix=${pathPrefix}&guide=${pathSuffix}&guideNumber=${guideNumber}`

                const response = await axios.get<{ markdown?: string, message?: string }>(nurl)
                if (response.data && response.data.markdown) {
                    setGuideHtml(htmlDeMd(response.data.markdown))
                } else if (response.data && response.data.message) {
                    throw new Error(response.data.message)
                }
                setCreditsHtml(htmlDeMd(course.creditosMd || ''))

            } catch (err) {
                if (err instanceof AxiosError) {
                    console.error("Error fetching guide content:", err)
                    setGuideHtml(`<p>Error: ${err.message}</p>`)
                }
            }
        }
        fetchGuideContent()
    }
  }, [course, guideNumber, lang, pathPrefix, pathSuffix, htmlDeMd])

  if (loading) {
    return <div className="p-10 mt-10">Loading guide...</div>
  }

  if (error) {
    return <div className="p-10 mt-10">Error: {error}</div>
  }

  if (!course || !myGuide) {
    return <div className="p-10 mt-10">Guide not found.</div>
  }

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

  if (
    !course.sinBilletera &&
    course.conBilletera &&
    (!session || !address || !session.address || session.address !== address)
  ) {
    return <div className="mt-40">Connect Wallet</div>
  }

  return (
    <>
      <div className="mt-8 pt-2 dark:bg-gray-100 dark:text-gray-800">
        <div className="container p-2 px-8 md:px-16 mx-auto pt-16 space-y-1">
          <h3 className="pb-1 text-1xl font-bold md:text-1xl text-center">
            {course.idioma === 'en' ? 'Course: ' : 'Curso: '}
            {course.titulo}
          </h3>
        </div>
        <h1 className="py-3 px-16 text-[2rem] font-bold text-left">
          {course.idioma === 'en' ? 'Guide' : 'Guía'}
          &nbsp;
          <span>{guideNumber}</span>: {myGuide.titulo}
          {myGuide.completed ? ' ✅' : ''}
          {myGuide.receivedScholarship ? ' 💰' : ''}
        </h1>
        <div
          className="py-3 px-16 text-1xl md:text-1xl text-justify **:list-inside"
          dangerouslySetInnerHTML={{ __html: guideHtml }}
        />
        {isClient && pathPrefix === 'gooddollar' && pathSuffix === 'guide1' && (
          <GoodDollarClaimButton
            lang={course.idioma}
            pathPrefix={pathPrefix}
            pathSuffix={pathSuffix}
          />
        )}

        <table className="mx-auto text-center mt-12">
          <tbody>
            <tr>
              <td>
                {previousGuidePath ? (
                  <Button asChild>
                    <Link href={previousGuidePath}>
                      {course.idioma === 'en' ? 'Previous' : 'Anterior'}
                    </Link>
                  </Button>
                ) : (
                  <Button disabled>
                    {course.idioma === 'en' ? 'Previous' : 'Anterior'}
                  </Button>
                )}
              </td>
              <td>
                <Button asChild>
                  <Link className="text-primary-foreground!" href={coursePath}>
                    {course.idioma === 'en'
                      ? 'Start of Course'
                      : 'Inicio del Curso'}
                  </Link>
                </Button>
              </td>
              <td>
                {nextGuidePath ? (
                  <Button asChild>
                    <Link className="text-primary-foreground!" href={nextGuidePath}>
                      {course.idioma === 'en' ? 'Next' : 'Siguiente'}
                    </Link>
                  </Button>
                ) : (
                  <Button disabled>
                    {course.idioma === 'en' ? 'Next' : 'Siguiente'}
                  </Button>
                )}
              </td>
            </tr>
          </tbody>
        </table>
        {creditsHtml && (
          <div className="text-sm mt-2">
            <h2 className="px-16 text-1xl font-bold md:text-1xl">
              {course.idioma === 'en'
                ? 'Credits and License of this course'
                : 'Créditos y Licencia de este curso'}
            </h2>
            <div
              className="py-3 px-16 text-1xl md:text-1xl text-justify"
              dangerouslySetInnerHTML={{ __html: creditsHtml }}
            />
          </div>
        )}
      </div>

      <div>&nbsp;</div>
    </>)
}
