"use client"

import axios from 'axios';
import { useSession } from "next-auth/react" 
import {use, useEffect, useState} from "react"
import remarkDirective from 'remark-directive'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import {unified} from 'unified'
//  import addFillInTheBlank from '../lib/add-fill-in-the-blank'


type PageProps = {
    params: Promise<{ 
      lang: string,
      pathPrefix: string,
    }>;
};

export default function Page({ params }: PageProps) {

  const { data: session } = useSession()

  const [myCourse, setMyCourse] = useState({
    idioma: 'en',
    cursosPrerequisito: '',
    prerequisitosMd: '',
  })
  const [title, setTitle] = useState("")
  const [subtitle, setSubtitle] = useState("")
  const [image, setImage] = useState("null")
  const [imageCredits, setImageCredits] = useState("")
  const [imageLink, setImageLink] = useState("")
  const [altImage, setAltImage] = useState("")
  const [htmlSummary, setHtmlSummary] = useState("")
  const [htmlExtended, setHtmlExtended] = useState("")
  const [contentsHtml, setContentsHtml] = useState("")
  const [toPay, setToPay] = useState(0)

  const parameters = use(params);
  const { lang, pathPrefix } = parameters;

  const [red, setRed] = useState("CELO")
  const [estadoBoton, setEstadoBoton] = useState("Desconectar")

  const [preHtml, setPreHtml] = useState("")
  const [preCourseHtml, setPreCourseHtml] = useState("")


  let htmlDeMd = (md: string) => {
    let processor = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkDirective)
      .use(remarkFrontmatter)
 //     .use(addFillInTheBlank)
      .use(remarkRehype)
      .use(rehypeStringify)
    let html = processor.processSync(md).toString()

    return html
  }

  useEffect(() => {
    let url = `${process.env.NEXT_PUBLIC_API_BUSCA_CURSOS_URL ?? "l"}?` +
      `filtro[busprefijoRuta]=/${pathPrefix}&` +
      `filtro[busidioma]=${lang}`
    if (session) {
      url += `&walletAddress=${session.address}`
    }
    console.log(`Fetching ${url}`)
    axios.get(url)
    .then(response => {
      if (response.data) {
        if (response.data.length != 1) {
          return false
        }
        let rcurso = response.data[0]
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

        let pc = process.env.NEXT_PUBLIC_API_PRESENTA_CURSO_URL ?? "x"
        let urld = pc.replace("curso_id", rcurso.id)
        if (session) {
          urld += `&walletAddress=${session.address}`
        }
        console.log(`Fetching ${urld}`)
        axios.get(urld)
        .then(responsed => {
          if (responsed.data) {
            if (response.data.length != 1) {
              return false
            }
            let dcurso = responsed.data

            let cursosPrerequisitoMd = ""
/*            if (typeof myCourse.cursosPrerequisito != "undefined") {
              for (const prefijoCp of myCourse.cursosPrerequisito) {
                let cp = cursos.filter( r:any => r.prefijoRuta == prefijoCp)[0]
                cursosPrerequisitoMd += "* " + "[" + cp.titulo + "](/" +
                  cp.idioma + "/" + cp.prefijoRuta + ")\n"
              }
            } */
            //preCourseHtml.value = htmlDeMd(cursosPrerequisitoMd)
            let guias="<ol class='list-decimal text-white'>\n"
            let numero = 1
            for (const guia of dcurso.guias) {
              guias += "<li>"
              if (guia.sufijoRuta != null) {

                guias += `<a href='/${rcurso.idioma}${rcurso.prefijoRuta}` +
                  `/${guia.sufijoRuta}' `+
                  `style='text-decoration: underline'>${guia.titulo}</a>`
              } else {
                guias += guia.titulo
              }
              guias += "</li>\n"
            }
            guias += "</ol>\n"
            setContentsHtml(guias)
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

    setToPay(0) //myCourse.toPay

  }, [session])

  return (
  <div className="mt-8 container flex flex-col mx-auto lg:flex-row justify-center">
    { (toPay == 0 || estadoBoton == 'Desconectar') &&
      <div className="flex flex-col items-center justify-center p-4 md:p-8 lg:p-12 lg:w-1/2 xl:w-3/5">
        <div>
          <div className="text-2xl lg:text-2xl font-bold pb-6 pt-14 text-center"><h1>{title}</h1></div>
          <div className="text-1xl lg:text-1xl font-bold"><h2>{subtitle}</h2></div>
        </div>
        <div className="image">
          <figure>
            <img src={image} width="300px" alt={altImage} className="py-6"/>
            <figcaption className="pb-6">
              <a
                target="_blank"
                href={imageLink}>
                {imageCredits}
              </a>
            </figcaption>
          </figure>
        </div>
        <div className="text-justify" dangerouslySetInnerHTML={{ __html: htmlSummary }}></div>
      </div>
    }
    <div className="my-2 pt-2">
      { (myCourse.prerequisitosMd || myCourse.cursosPrerequisito) &&
        <div  className="px-6 h-full  w-full sm:p-8 lg:p-12 lg:w-5/18 xl:w-5/18 rounded-sm bg-secondary-100 dark:text-gray-50">
          <h2 className="text-2xl font-bold py-2 text-white">Pre-requisitos</h2>
          <div dangerouslySetInnerHTML={{ __html: preHtml}}></div>
          { preCourseHtml != '' &&
            <div>
              Cursos
              <div dangerouslySetInnerHTML={{ __html: preCourseHtml}}></div>
            </div>
          }
        </div>
      }
      <div  className="px-6 py-8 h-full  w-full sm:p-8 lg:p-12 rounded-sm bg-secondary-100 dark:text-gray-50">
        <h2 className="text-2xl lg:text-2xl font-bold py-8 text-white">
          {myCourse.idioma == 'en' ?
            "Course contents" : "Contenido del curso" }
        </h2>
        <div dangerouslySetInnerHTML={{ __html: contentsHtml}} active-class="active"  className="list-decimal text-justify text-base/10"></div>
      </div>
      { estadoBoton == 'Desconectar' && (
        <div>
          <div dangerouslySetInnerHTML={{ __html: htmlExtended }}></div>
          { (red == 'Red: X Layer Mainnet' && toPay > 0) && (
            <div>
              <button
                 className="hidden md:block px-8 py-3 rounded-full text-white font-medium tracking-wider uppercase bg-secondary-100 w-full lg:w-auto">
                 Inscribirse por {toPay}OKB
               </button>
            </div>
          )}
        </div>
      )}
    </div>
  </div>
  )

  /*figcaption {
    font-size: 0.8rem;
    text-align: right;
  }*/

}
