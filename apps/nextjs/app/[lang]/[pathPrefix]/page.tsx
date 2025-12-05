'use client'

import axios from 'axios'
import { useSession, getCsrfToken } from 'next-auth/react'
import { use, useEffect, useState } from 'react'
import remarkDirective from 'remark-directive'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import { unified } from 'unified'
import { useAccount } from 'wagmi'
import { Button } from '@/components/ui/button'
//  import addFillInTheBlank from '../lib/add-fill-in-the-blank'

type PageProps = {
  params: Promise<{
    lang: string
    pathPrefix: string
  }>
}

export default function Page({ params }: PageProps) {
  const { address } = useAccount()
  const { data: session } = useSession()

  const [myCourse, setMyCourse] = useState({
    idioma: 'en',
    cursosPrerequisito: '',
    prerequisitosMd: '',
  })
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [image, setImage] = useState('null')
  const [imageCredits, setImageCredits] = useState('')
  const [imageLink, setImageLink] = useState('')
  const [altImage, setAltImage] = useState('')
  const [htmlSummary, setHtmlSummary] = useState('')
  const [htmlExtended, setHtmlExtended] = useState('')
  const [contentsHtml, setContentsHtml] = useState('')
  const [toPay, setToPay] = useState(0)

  const parameters = use(params)
  const { lang, pathPrefix } = parameters

  const [red, setRed] = useState('CELO')
  const [estadoBoton, setEstadoBoton] = useState('Desconectar')

  const [preHtml, setPreHtml] = useState('')
  const [preCourseHtml, setPreCourseHtml] = useState('')

  const htmlDeMd = (md: string) => {
    const processor = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkDirective)
      .use(remarkFrontmatter)
      //     .use(addFillInTheBlank)
      .use(remarkRehype)
      .use(rehypeStringify)
    const html = processor.processSync(md).toString()

    return html
  }

  useEffect(() => {
    if (
      (session && !address) ||
      (address && !session) ||
      (address && session && session.address && address != session.address)
    ) {
      return
    }

    const configurar = async () => {
      let url =
        `${process.env.NEXT_PUBLIC_API_BUSCA_CURSOS_URL ?? 'l'}?` +
        `filtro[busprefijoRuta]=/${pathPrefix}&` +
        `filtro[busidioma]=${lang}`
      let csrfToken = ''
      if (session && address && session.address && session.address == address) {
        csrfToken = (await getCsrfToken()) || ''
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
            setMyCourse(rcurso)
            setTitle(rcurso.titulo)
            setSubtitle(rcurso.subtitulo)
            setImage(rcurso.imagen)
            setImageCredits(rcurso.creditoImagen)
            setImageLink(rcurso.enlaceImagen)
            setAltImage(rcurso.altImagen)
            // Idea de usar remark de freecodecamp
            setHtmlSummary(htmlDeMd(rcurso.resumenMd))
            setHtmlExtended(htmlDeMd(rcurso.ampliaMd))

            //preHtml.value = htmlDeMd(rcurso.prerequisitosMd)

            let pc = process.env.NEXT_PUBLIC_API_PRESENTA_CURSO_URL ?? 'x'
            let urld = pc.replace('curso_id', rcurso.id)
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
                  let dcurso = responsed.data

                  let cursosPrerequisitoMd = ''
                  /*            if (typeof myCourse.cursosPrerequisito != "undefined") {
                            for (const prefijoCp of myCourse.cursosPrerequisito) {
                            let cp = cursos.filter( r:any => r.prefijoRuta == prefijoCp)[0]
                            cursosPrerequisitoMd += "* " + "[" + cp.titulo + "](/" +
                            cp.idioma + "/" + cp.prefijoRuta + ")\n"
                            }
                            } */
                  //preCourseHtml.value = htmlDeMd(cursosPrerequisitoMd)
                  const buildGuidesHtml = async (guides: any[], courseId: string, idioma: string, prefijoRuta: string, session: any, address: string | undefined) => {
                    let guias = "<ol class='list-decimal text-primary-foreground'>\n"
                    // Prepare status fetches for guides with sufijoRuta
                    const statusPromises = []
                    for (let i = 0; i < guides.length; i++) {
                      const guia = guides[i]
                      if (guia.sufijoRuta != null && session && address) {
                        const statusUrl = '/api/guide-status?' +
                          `walletAddress=${address}&` +
                          `courseId=${courseId}&` +
                          `guideNumber=${i + 1}`
                        statusPromises.push(axios.get(statusUrl))
                      } else {
                        statusPromises.push(Promise.resolve(null))
                      }
                    }
                    const statusResults = await Promise.allSettled(statusPromises)
                    // Now build HTML
                    for (let i = 0; i < guides.length; i++) {
                      const guia = guides[i]
                      guias += '<li>'
                      if (guia.sufijoRuta != null) {
                        guias += `<a href='/${idioma}${prefijoRuta}/${guia.sufijoRuta}' style='text-decoration: underline'>${guia.titulo}</a>`
                        // Add indicators if status fetch succeeded
                        const result = statusResults[i]
                        if (result && result.status === 'fulfilled' && result.value) {
                          const { completed, receivedScholarship } = result.value.data
                          if (completed) guias += ' ✅'
                          if (receivedScholarship) guias += ' 💰'
                        }
                      } else {
                        guias += guia.titulo
                      }
                      guias += '</li>\n'
                    }
                    guias += '</ol>\n'
                    return guias
                  }
                  buildGuidesHtml(dcurso.guias, dcurso.id, rcurso.idioma, rcurso.prefijoRuta, session, address)
                    .then((guias) => setContentsHtml(guias))
                    .catch((error) => console.error('Error building guides HTML', error))
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

      setToPay(0) //myCourse.toPay
    }
    configurar()
  }, [session, address, lang, pathPrefix])

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

  return (
    <div className="container mx-auto my-8 flex flex-col lg:flex-row justify-center gap-6 min-h-screen">
      {/* Columna izquierda */}
      {(toPay === 0 || estadoBoton === 'Desconectar') && (
        <section className="flex flex-col items-center justify-center p-6 md:p-10 lg:p-12 lg:w-1/2 xl:w-3/5 bg-white rounded-2xl shadow">
          {/* Título */}
          <header className="text-center mb-6">
            <h1 className="text-2xl lg:text-3xl font-bold mb-2">{title}</h1>
            <h2 className="text-lg lg:text-xl font-semibold text-gray-600">
              {subtitle}
            </h2>
          </header>

          {/* Imagen */}
          <figure className="my-6">
            <img
              src={image}
              width="300"
              alt={altImage}
              className="mx-auto rounded-lg shadow-md"
            />
            <figcaption className="text-sm text-gray-500 mt-3 text-center">
              <a
                href={imageLink}
                target="_blank"
                className="underline hover:text-secondary-600"
              >
                {imageCredits}
              </a>
            </figcaption>
          </figure>

          {/* Resumen */}
          <article
            className="prose max-w-prose text-justify text-gray-700"
            dangerouslySetInnerHTML={{ __html: htmlSummary }}
          />
        </section>
      )}

      {/* Columna derecha */}
      <aside className="flex flex-col gap-6 w-full lg:w-2/5">
        {/* Pre-requisitos */}
        {(myCourse.prerequisitosMd || myCourse.cursosPrerequisito) && (
          <div className="px-6 py-8 rounded-xl bg-white text-gray-800 shadow">
            <h2 className="text-2xl font-bold mb-4">Pre-requisitos</h2>
            <div dangerouslySetInnerHTML={{ __html: preHtml }} />
            {preCourseHtml !== '' && (
              <div className="mt-4">
                <h3 className="font-semibold">Cursos</h3>
                <div dangerouslySetInnerHTML={{ __html: preCourseHtml }} />
              </div>
            )}
          </div>
        )}

        {/* Contenidos */}
        <div className="px-6 py-8 rounded-xl bg-white text-gray-800 shadow">
          <h2 className="text-2xl lg:text-3xl font-bold mb-6">
            {myCourse.idioma === 'en'
              ? 'Course contents'
              : 'Contenido del curso'}
          </h2>
          <div
            className="list-decimal text-justify space-y-2"
            dangerouslySetInnerHTML={{ __html: contentsHtml }}
          />
        </div>

        {/* Extendido + Botón */}
        {estadoBoton === 'Desconectar' && (
          <div>
            <div dangerouslySetInnerHTML={{ __html: htmlExtended }} />
            {red === 'Red: X Layer Mainnet' && toPay > 0 && (
              <Button
                variant="secondary"
                size="lg"
                className="mt-6 w-full lg:w-auto rounded-full uppercase shadow-md hover:shadow-lg hover:scale-105 transition-transform duration-200"
              >
                Inscribirse por {toPay} OKB
              </Button>
            )}
          </div>
        )}
      </aside>
    </div>
  )
}
