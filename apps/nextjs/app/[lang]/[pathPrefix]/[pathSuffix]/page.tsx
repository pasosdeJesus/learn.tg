'use client'

import axios, { AxiosError } from 'axios'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkDirective from 'remark-directive'
import remarkFrontmatter from 'remark-frontmatter'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import { unified } from 'unified'
import type { Processor } from 'unified'
import { useAccount } from 'wagmi'

import CeloUbiButton from '@/components/CeloUbiButton'
import GoodDollarClaimButton from '@/components/GoodDollarClaimButton'
import { Button } from '@/components/ui/button'
import { useGuideData } from '@/lib/hooks/useGuideData'
import { remarkFillInTheBlank } from '@/lib/remarkFillInTheBlank.mjs'

export default function Page() {
  const params = useParams()
  const { address } = useAccount()
  const { data: session } = useSession()
  const { lang, pathPrefix, pathSuffix } = params as { lang: string; pathPrefix: string; pathSuffix: string }

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
  const [showGoodDollarButton, setShowGoodDollarButton] = useState(false)
  const [showCeloUbiButton, setShowCeloUbiButton] = useState(false)


  const htmlDeMd = useCallback((md: string) => {
    if (!md) return ''

    let processedMd = md
    if (address) {
        processedMd = processedMd.replace(/\{walletAddress\}/g, 
            `<p class="font-mono bg-gray-200 dark:bg-gray-700 p-2 rounded break-words"><strong>Your connected address:</strong><br/>${address}</p>`
        )
    } else {
        processedMd = processedMd.replace(/\{walletAddress\}/g, 
            '<p class="text-center"><i>Connect your wallet to see your address here.</i></p>'
        )
    }

    const processor = (unified() as any)
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkDirective)
      .use(remarkFrontmatter)
      .use(remarkFillInTheBlank, { url: `${pathSuffix}/test`, lang: lang})
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeStringify, { allowDangerousHtml: true })
    const html = processor.processSync(processedMd).toString()

    if (typeof window !== 'undefined') {
      const fillInTheBlankQuestions = (window as Window & { fillInTheBlank?: unknown[] }).fillInTheBlank || []
      
      const processedQuestions = fillInTheBlankQuestions.map(q => {
        const question = q as { answer: string }
        if (question.answer === '{last4WalletAddress}') {
          return {
            ...question,
            answer: address ? address.slice(-4) : 'xxxx',
          }
        }
        return question
      })

      localStorage.setItem(
        'fillInTheBlank',
        JSON.stringify(processedQuestions),
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
          '</p>',
      )
      .replaceAll('<li><p>([^<]*)</p></li>', '<li>$1</li>')
      .replaceAll('<p>', '<p class="pt-2 pb-2">')
      .replaceAll('<ul>', '<ul class="block list-disc ml-8">')

    return html_con_tailwind
  }, [pathSuffix, address])

  useEffect(() => {
    setIsClient(true)
    if (course && guideNumber > 0) {
        const fetchGuideContent = async () => {
            try {
                const nurl = `${process.env.NEXT_PUBLIC_AUTH_URL}/api/guide?courseId=${course.id}` +
                    `&lang=${lang}&prefix=${pathPrefix}&guide=${pathSuffix}&guideNumber=${guideNumber}`

                const response = await axios.get<{ markdown?: string, message?: string }>(nurl)
                if (response.data && response.data.markdown) {
                    const markdown = response.data.markdown

                    // Detect buttons before altering the markdown
                    const hasGoodDollarButton = markdown.includes('{GoodDollarButton}')
                    const hasCeloUbiButton = markdown.includes('{CeloUbiButton}')

                    setShowGoodDollarButton(hasGoodDollarButton)
                    setShowCeloUbiButton(hasCeloUbiButton)

                    // Clean up all placeholders at once
                    const cleanedMarkdown = markdown.replace(/\{GoodDollarButton\}|\{CeloUbiButton\}/g, '')
                    
                    setGuideHtml(htmlDeMd(cleanedMarkdown))
                } else if (response.data && response.data.message) {
                    throw new Error(response.data.message)
                }
                setCreditsHtml(htmlDeMd(course.creditosMd || ''))

            } catch (err) {
                if (err instanceof AxiosError) {
                    console.error("Error fetching guide content:", err)
                    setGuideHtml(`<p>Error: ${err.message}</p>`)
                } else {
                    console.error("An unexpected error occurred:", err);
                    setGuideHtml(`<p>An unexpected error occurred</p>`);
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
      <article className="mt-8 pt-2 dark:bg-gray-100 dark:text-gray-800" aria-label="Guide content">
        <header className="container p-2 px-8 md:px-16 mx-auto pt-16 space-y-1">
          <h3 className="pb-1 text-1xl font-bold md:text-1xl text-center">
            {course.idioma === 'en' ? 'Course: ' : 'Curso: '}{course.titulo}
          </h3>
        </header>
        <h1 className="py-3 px-16 text-[2rem] font-bold text-left">
          {course.idioma === 'en' ? 'Guide' : 'Guía'}
          &nbsp;
          <span>{guideNumber}</span>: {myGuide.titulo}
          {myGuide.completed ? ' ✅' : ''}
          {myGuide.receivedScholarship ? ' 💰' : ''}
        </h1>
        <section
          className="py-3 px-16 text-1xl md:text-1xl text-justify **:list-inside"
          dangerouslySetInnerHTML={{ __html: guideHtml }}
          aria-label="Guide text"
        />
        <aside className="flex space-x-4 items-center justify-center" aria-label="Interactive buttons">
          {isClient && showGoodDollarButton && (
            <GoodDollarClaimButton
            lang={course.idioma}
            />
          )}
          {isClient && showCeloUbiButton && 
            <CeloUbiButton 
            lang={course.idioma}
            />
          }
        </aside>

        <nav aria-label="Guide navigation"><table className="mx-auto text-center mt-12">
          <tbody>
            <tr>
              <td>
                {previousGuidePath ? (
                  <Button asChild>
                    <Link className="text-primary-foreground!" href={previousGuidePath}>
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
        </table></nav>
        {creditsHtml && (
          <footer className="text-sm mt-2" aria-label="Course credits and license">
            <h2 className="px-16 text-1xl font-bold md:text-1xl">
              {course.idioma === 'en'
                ? 'Credits and License of this course'
                : 'Créditos y Licencia de este curso'}
            </h2>
            <div
              className="py-3 px-16 text-1xl md:text-1xl text-justify"
              dangerouslySetInnerHTML={{ __html: creditsHtml }}
            />
          </footer>
        )}
      </article>

      <div>&nbsp;</div>
    </>
  )
}
