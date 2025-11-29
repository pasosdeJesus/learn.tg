'use client'

import axios from 'axios'
import { ClaimSDK, useIdentitySDK } from '@goodsdks/citizen-sdk'
import { type PublicClient, type WalletClient } from 'viem'
import { useSession, getCsrfToken } from 'next-auth/react'
import { use, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import remarkDirective from 'remark-directive'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import { unified } from 'unified'
import { usePublicClient, useWalletClient } from 'wagmi'
import { useAccount } from 'wagmi'

import { remarkFillInTheBlank } from '@/lib/remarkFillInTheBlank.mjs'
import { Button } from '@/components/ui/button'

export default function Page({
  params,
}: {
  params: Promise<{
    lang: string
    pathPrefix: string
    pathSuffix: string
  }>
}) {
  const { address } = useAccount()
  const { data: session } = useSession()

  const [course, setCourse] = useState({
    conBilletera: false,
    guias: [],
    idioma: '',
    titulo: '',
    sinBilletera: false,
  })
  const [guideNumber, setGuideNumber] = useState(0)
  const [myGuide, setMyGuide] = useState({
    titulo: '',
  })
  const [coursePath, setCoursePath] = useState('')
  const [nextGuidePath, setNextGuidePath] = useState('')
  const [previousGuidePath, setPreviousGuidePath] = useState('')
  const [guideHtml, setGuideHtml] = useState('')
  const [creditsHtml, setCreditsHtml] = useState('')
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    if (
      (session && !address) ||
      (address && !session) ||
      (address && session && session.address && address != session.address)
    ) {
      return
    }
    const configurar = async () => {
      setIsClient(true)
      setCoursePath(`/${lang}/${pathPrefix}`)
      let url =
        `${process.env.NEXT_PUBLIC_API_BUSCA_CURSOS_URL}?` +
        `filtro[busprefijoRuta]=/${pathPrefix}&` +
        `filtro[busidioma]=${lang}`
      const csrfToken = await getCsrfToken()
      if (session && address && session.address && session.address == address) {
        url += `&walletAddress=${session.address}` + `&token=${csrfToken}`
      }
      console.log(`Fetching ${url}`)
      axios
        .get(url)
        .then((response) => {
          if (response.data) {
            if (response.data.length != 1) {
              return false
            }
            const rcurso = response.data[0]

            if (process.env.NEXT_PUBLIC_API_PRESENTA_CURSO_URL == undefined) {
              alert('Undefined NEXT_PUBLIC_API_PRESENTA_CURSO_URL')
              return false
            }
            let urld = process.env.NEXT_PUBLIC_API_PRESENTA_CURSO_URL.replace(
              'curso_id',
              rcurso.id,
            )
            if (
              session &&
              address &&
              session.address &&
              session.address == address
            ) {
              urld +=
                `&walletAddress=${session.address}` + `&token=${csrfToken}`
            }
            console.log(`Fetching ${urld}`)
            axios
              .get(urld)
              .then((responsed) => {
                if (responsed.data) {
                  if (response.data.length != 1) {
                    return false
                  }
                  const dcurso = responsed.data
                  setCourse(dcurso)

                  let gnumber = 0
                  for (let g = 0; g < dcurso.guias.length; g++) {
                    if (dcurso.guias[g].sufijoRuta == pathSuffix) {
                      setGuideNumber(g + 1)
                      gnumber = g + 1
                      setMyGuide(dcurso.guias[g])
                    }
                  }

                  if (gnumber > 1) {
                    const ga = dcurso.guias[gnumber - 2]
                    setPreviousGuidePath(
                      '/' +
                        dcurso.idioma +
                        dcurso.prefijoRuta +
                        '/' +
                        ga.sufijoRuta,
                    )
                  }

                  if (gnumber < dcurso.guias.length) {
                    const gs = dcurso.guias[gnumber]
                    setNextGuidePath(
                      '/' +
                        dcurso.idioma +
                        dcurso.prefijoRuta +
                        '/' +
                        gs.sufijoRuta,
                    )
                  }

                  setCreditsHtml(htmlDeMd(dcurso.creditosMd))

                  if (process.env.NEXT_PUBLIC_API_DESCARGA_URL == undefined) {
                    alert('Undefined NEXT_PUBLIC_API_DESCARGA_URL')
                    return false
                  }
                  let nurl =
                    process.env.NEXT_PUBLIC_AUTH_URL +
                    `/api/guide?courseId=${dcurso.id}` +
                    `&lang=${lang}` +
                    `&prefix=${pathPrefix}` +
                    `&guide=${pathSuffix}` +
                    `&guideNumber=${guideNumber}`
                  if (
                    session &&
                    address &&
                    session.address &&
                    session.address == address
                  ) {
                    nurl +=
                      `&walletAddress=${session.address}` +
                      `&token=${csrfToken}`
                  }
                  console.log(`Fetching ${nurl}`)
                  axios
                    .get(nurl)
                    .then((response) => {
                      if (response.data) {
                        if (response.data.message != '') {
                          alert(response.data.message)
                        } else {
                          setGuideHtml(htmlDeMd(response.data.markdown))
                        }
                      }
                    })
                    .catch((error) => {
                      console.error(error)
                    })
                }
              })
              .catch((error) => {
                console.error(error)
              })
          }
        })
        .catch((error) => {
          console.error(error)
        })
    }
    configurar()
  }, [session, address])

  const parameters = use(params)
  const { lang, pathPrefix, pathSuffix } = parameters

  const htmlDeMd = useCallback(
    (md: string) => {
      const processor = unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkDirective)
        .use(remarkFrontmatter)
        .use(remarkFillInTheBlank, { url: `${pathSuffix}/test` })
        // @ts-ignore
        .use(remarkRehype, { allowDangerousHtml: true })
        .use(rehypeStringify, { allowDangerousHtml: true })
      const html = processor.processSync(md).toString()

      // Save questions
      localStorage.setItem(
        'fillInTheBlank',
        JSON.stringify(
          (window as Window & { fillInTheBlank?: any[] }).fillInTheBlank || [],
        ),
      )

      // Agregamos estilo
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
    },
    [pathSuffix],
  )

  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const identitySDK =
    process.env.NEXT_PUBLIC_AUTH_URL == 'https://learn.tg'
      ? useIdentitySDK('production')
      : null

  const claimUBI = async () => {
    if (
      !session ||
      !address ||
      session.address != address ||
      !publicClient ||
      !walletClient ||
      !identitySDK
    ) {
      return <div>Works only with wallet connected</div>
    }

    const claimSDK = new ClaimSDK({
      account: session.address,
      publicClient,
      walletClient,
      identitySDK,
      env: 'production',
    })

    try {
      await claimSDK.claim()
      console.log('Claim successful')
      alert('Claim successful')
    } catch (error) {
      console.error('Claim failed:', error)
      alert('Claim failed:' + JSON.stringify(error))
    }
  }

  if (
    (session && !address) ||
    (address && !session) ||
    (address && session && session.address && address != session.address)
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
    (!session || !address || !session.address || session.address != address)
  ) {
    return <div className="mt-40">Connect Wallet</div>
  }

  return (
    <>
      <div className="mt-8 pt-2  dark:bg-gray-100 dark:text-gray-800">
        <div className="container p-2 px-8 md:px-16 mx-auto pt-16 space-y-1">
          <h3 className="pb-1 text-1xl font-bold md:text-1xl text-center">
            {course.idioma == 'en' ? 'Course:' : 'Curso:'}
            {course.titulo}
          </h3>
        </div>
        <h1 className="py-3 px-16 text-[2rem] font-bold text-left">
          {course.idioma == 'en' ? 'Guide' : 'Guía'}
          &nbsp;
          <span>{guideNumber}</span>: {myGuide.titulo}
        </h1>
        <div
          className="py-3 px-16 text-1xl md:text-1xl text-justify **:list-inside"
          dangerouslySetInnerHTML={{ __html: guideHtml }}
        />
        {isClient && pathPrefix == 'gooddollar' && pathSuffix == 'guide1' && (
          <div className="flex items-center justify-center">
            <Button onClick={claimUBI} size="lg">
              Sign up with GoodDollar or Claim UBI
            </Button>
          </div>
        )}

        <table className="mx-auto text-center mt-12">
          <tbody>
            <tr>
              <td>
                {guideNumber > 1 && (
                  <Button asChild>
                    <Link href={previousGuidePath}>
                      {course.idioma == 'en' ? 'Previous' : 'Anterior'}
                    </Link>
                  </Button>
                )}
                {guideNumber <= 1 && (
                  <Button disabled>
                    {course.idioma == 'en' ? 'Previous' : 'Anterior'}
                  </Button>
                )}
              </td>
              <td>
                <Button asChild>
                  <Link className="text-primary-foreground!" href={coursePath}>
                    {course.idioma == 'en'
                      ? 'Start of Course'
                      : 'Inicio del Curso'}
                  </Link>
                </Button>
              </td>
              <td>
                &nbsp;
                {guideNumber < course.guias.length && (
                  <Button asChild>
                    <Link
                      className="text-primary-foreground!"
                      href={nextGuidePath}
                    >
                      {course.idioma == 'en' ? 'Next' : 'Siguiente'}
                    </Link>
                  </Button>
                )}
                {guideNumber >= course.guias.length && (
                  <Button disabled>
                    {course.idioma == 'en' ? 'Next' : 'Siguiente'}
                  </Button>
                )}
              </td>
            </tr>
          </tbody>
        </table>
        {creditsHtml != '' && (
          <div className="text-sm mt-2">
            <h2 className="px-16 text-1xl font-bold md:text-1xl">
              {course.idioma == 'en'
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
    </>
  )
}
