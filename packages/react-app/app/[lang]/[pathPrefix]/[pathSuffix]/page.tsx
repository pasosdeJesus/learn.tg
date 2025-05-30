"use client"

import axios from 'axios';
import { use, useEffect, useState } from 'react'
import remarkDirective from 'remark-directive'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import {unified} from 'unified'
//import addFillInTheBlank from '../lib/add-fill-in-the-blank'


export default function Page({params} : {
  params: Promise<{
    lang:string,
    pathPrefix:string,
    pathSuffix:string,
  }>
}) {

  const [myCourse, setMyCourse] = useState({
    titulo: "",
    idioma: "",
    guias: []
  })
  const [guideNumber, setGuideNumber] = useState(0);
  const [myGuide, setMyGuide] = useState({
    titulo: "",
  });
  const [coursePath, setCoursePath] = useState("")
  const [nextGuidePath, setNextGuidePath] = useState("")
  const [previousGuidePath, setPreviousGuidePath] = useState("")
  const [guideHtml, setGuideHtml] = useState("")
  const [creditsHtml, setCreditsHtml] = useState("")
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    setCoursePath(`/${lang}/${pathPrefix}`)
    let url = `${process.env.NEXT_PUBLIC_API_BUSCA_CURSOS_URL}?` +
      `filtro[busprefijoRuta]=/${pathPrefix}&` +
      `filtro[busidioma]=${lang}`
    console.log(`Fetching ${url}`)
    axios.get(url)
      .then(response => {
        if (response.data) {
          if (response.data.length != 1) {
            alert("No se encontró el curso")
            return false
          }
          let rcurso = response.data[0]

          if (process.env.NEXT_PUBLIC_API_PRESENTA_CURSO_URL == undefined) {
            alert("NEidiomaXT_PUBLIC_API_PRESENTA_CURSO_URL no definido")
            return false
          }
          let urld = process.env.NEXT_PUBLIC_API_PRESENTA_CURSO_URL.replace(
            "curso_id", rcurso.id
          )
          console.log(`Fetching ${urld}`)
          axios.get(urld)
            .then(responsed => {
              if (responsed.data) {
                if (response.data.length != 1) {
                 alert("No se encontró el curso")
                 return false
                }
                let dcurso = responsed.data

                setMyCourse(dcurso)

                let gnumber = 0
                for(let g=0; g < dcurso.guias.length; g++) {
                  if (dcurso.guias[g].sufijoRuta == (pathSuffix)) {
                    setGuideNumber(g + 1);
                    gnumber = g + 1
                    setMyGuide(dcurso.guias[g])
                  }
                }

                if (gnumber > 1) {
                  let ga = dcurso.guias[gnumber - 2]
                  setPreviousGuidePath("/" + dcurso.idioma +
                    dcurso.pathPrefix + "/" + ga.sufijoRuta)
                }

                if (gnumber < dcurso.guias.length) {
                  let gs = dcurso.guias[gnumber]
                  setNextGuidePath("/" + dcurso.idioma +
                    dcurso.pathPrefix + "/" + gs.sufijoRuta)
                }

                setCreditsHtml(htmlDeMd(dcurso.creditosMd))
                let urlg = window.location.href + ".md"
                console.log(`Fetching ${urlg}`)
                axios.get(urlg)
                  .then(response => {
                    if (response.data) {
                      setGuideHtml(htmlDeMd(response.data))
                    }
                  })
                  .catch(error => {
                    console.error(error);
                  })
              }
            })
            .catch(error => {
              console.error(error);
            })
        }
      })
      .catch(error => {
        console.error(error);
      })

  }, [])


  const parameters = use(params)
  const { lang, pathPrefix, pathSuffix } = parameters


  let htmlDeMd = (md: string) => {
    let processor = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkDirective)
      .use(remarkFrontmatter)
      //.use(addFillInTheBlank)
      .use(remarkRehype)
      .use(rehypeStringify)
    let html = processor.processSync(md).toString()

    // Agregamos estilo
    let html_con_tailwind = html.replaceAll(
      "<a href", '<a class="underline" href'
    ).replaceAll(
      "<blockquote>", '<blockquote class="ml-8 pt-2">'
    ).replaceAll(
      "<code>", '<code class="bg-gray-200">'
    ).replaceAll(
      "<h1>", '<h1 class="pt-6 pb-2 font-bold text-[1.9rem]">'
    ).replaceAll(
      "<h2>", '<h2 class="pt-6 pb-2 font-bold text-[1.7rem]">'
    ).replaceAll(
      "<h3>", '<h2 class="pt-6 pb-2 font-bold text-[1.5rem]">'
    ).replace(
      /(<img [^>]*)>/g, '$1 class="pb-2">'
    ).replace(
      /(<img [^>]*><\/p>\n)<p>/g, '$1<p class="flex justify-end">'
    ).replace(
      /(<ol[^>]*)>/g, '$1 class="block list-decimal ml-8">'
    ).replaceAll(
      "<p><img",
      '<p class="pt-4 flex justify-center">'+
      '<img'
    ).replace(
      /<p><a([^>]*youtube.com\/watch[^>]*)><img/g,
      '<p class="pt-4 pb-4 flex justify-center"><a target="_blank" $1><img'
    ).replace(
      /<p><a[^>]*("https:\/\/www.youtube.com\/embed[^"]*")><img[^>]*><\/a><\/p>/g,
      '<p class="pt-4 pb-4 flex justify-center">'+
      '<iframe width="560" height="315" '+
      'src=$1 title="Reproductor de video de YouTube" frameborder="0" '+
      'allow="accelerometer; autoplay; clipboard-write; encrypted-media; '+
      'gyroscope; picture-in-picture; web-share" '+
      'referrerpolicy="strict-origin-when-cross-origin" '+
      'allowfullscreen></iframe>'+
      '</p>'
    ).replaceAll(
      "<p>", '<p class="pt-2 pb-2">'
    ).replaceAll(
      "<ul>", '<ul class="block list-disc ml-8">'
    )

    return html_con_tailwind
  }


  return (
    <div>
  <div className="pt-2  dark:bg-gray-100 dark:text-gray-800">
    <div className="container p-2 px-8 md:px-16 mx-auto pt-16 space-y-1">
      <h3 className="pb-1 text-1xl font-bold md:text-1xl text-center">
        {myCourse.idioma == 'en' ? "Course:" : "Curso:"}
        {myCourse.titulo}
      </h3>
    </div>
    <h1 className="py-3 px-16 text-[2rem] font-bold text-left">
      { myCourse.idioma == 'en' ? "Guide" : "Guía" }
      &nbsp;
      <span>{guideNumber}</span>: {myGuide.titulo}
    </h1>
    { isClient && 
      <div className="py-3 px-16 text-1xl md:text-1xl text-justify **:list-inside **:list-disc" dangerouslySetInnerHTML={{ __html: guideHtml }} />
    }
    { creditsHtml != '' && (
      <div>
        <h2 className="px-16 text-1xl font-bold md:text-1xl">
          { myCourse.idioma == 'en' ? "Credits" : "Créditos" }
        </h2>
        <div className="py-3 px-16 text-1xl md:text-1xl text-justify"
          dangerouslySetInnerHTML={{ __html: creditsHtml }} />
      </div>
    )}

    <table className="mx-auto text-center mt-12">
    <tbody>
      <tr>
        <td>
          { guideNumber > 1 &&
            (<a href={previousGuidePath} className="inline-flex items-center bg-gray-800 text-white border-r border-gray-100 py-2 px-3 hover:bg-secondary-100 hover:text-white">
             { myCourse.idioma == 'en' ? "Previous Guide" : "Guía anterior" }
            </a>)
          }
        </td>
        <td>
          <a href={coursePath} className="inline-flex items-center bg-gray-800 text-white py-2 px-3 hover:bg-secondary-100 hover:text-white">
            { myCourse.idioma == 'en' ? "Start of Course" : "Inicio del Curso"}
          </a>
        </td>
        <td>
          &nbsp;
          { guideNumber < myCourse.guias.length  && (
            <a href={nextGuidePath} className="inline-flex items-center bg-gray-800 text-white  py-2 px-3 hover:bg-secondary-100 hover:text-white">
              {myCourse.idioma == 'en' ? "Next Guide" : "Guía siguiente"}
            </a>
          )}
        </td>
      </tr>
    </tbody>
  </table>
  </div>

  <div>&nbsp;</div>
  </div>
  )
}
