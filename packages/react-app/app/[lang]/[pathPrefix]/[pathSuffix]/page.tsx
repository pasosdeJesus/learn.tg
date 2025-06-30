"use client"

import axios from 'axios';

import { ClaimSDK, useIdentitySDK } from '@goodsdks/citizen-sdk';
import { useSession } from "next-auth/react"
import { use, useEffect, useState } from 'react'
import remarkDirective from 'remark-directive'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import {unified} from 'unified'
import { usePublicClient, useWalletClient } from 'wagmi';
import { useAccount } from 'wagmi'
//import addFillInTheBlank from '../lib/add-fill-in-the-blank'


export default function Page({params} : {
  params: Promise<{
    lang:string,
    pathPrefix:string,
    pathSuffix:string,
  }>
}) {

  const { address } = useAccount()
  const { data: session } = useSession();

  const [course, setCourse] = useState({
    conBilletera: false,
    guias: [],
    idioma: "",
    titulo: "",
    sinBilletera: false,
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
    if ((session && !address) || (address && !session) || 
        (address && session && session.address && 
         address != session.address)) {
      return
    }
    setIsClient(true)
    setCoursePath(`/${lang}/${pathPrefix}`)
    let url = `${process.env.NEXT_PUBLIC_API_BUSCA_CURSOS_URL}?` +
      `filtro[busprefijoRuta]=/${pathPrefix}&` +
      `filtro[busidioma]=${lang}`
    if (session && address && session.address == address) {
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

          if (process.env.NEXT_PUBLIC_API_PRESENTA_CURSO_URL == undefined) {
            alert("Undefined NEXT_PUBLIC_API_PRESENTA_CURSO_URL")
            return false
          }
          let urld = process.env.NEXT_PUBLIC_API_PRESENTA_CURSO_URL.replace(
            "curso_id", rcurso.id
          )
          if (session && address && session.address == address) {
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
                setCourse(dcurso)

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
                    dcurso.prefijoRuta + "/" + ga.sufijoRuta)
                }

                if (gnumber <  dcurso.guias.length) {
                  let gs = dcurso.guias[gnumber]
                  setNextGuidePath("/" + dcurso.idioma +
                    dcurso.prefijoRuta + "/" + gs.sufijoRuta)
                }

                setCreditsHtml(htmlDeMd(dcurso.creditosMd))

                if (process.env.NEXT_PUBLIC_API_DESCARGA_URL == undefined) {
                  alert("Undefined NEXT_PUBLIC_API_DESCARGA_URL")
                  return false
                }
                let nurl = process.env.NEXT_PUBLIC_API_DESCARGA_URL.replace(
                  "lang", lang
                ).replace(
                  "prefix", pathPrefix
                ).replace(
                  "guia", pathSuffix
                )
                if (session && address && session.address == address) {
                  nurl += `&walletAddress=${session.address}`
                }
                console.log(`Fetching ${nurl}`)
                axios.get(nurl)
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

  }, [session, address])


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
      "<li><p>([^<]*)</p></li>","<li>$1</li>"
    ).replaceAll(
      "<p>", '<p class="pt-2 pb-2">'
    ).replaceAll(
      "<ul>", '<ul class="block list-disc ml-8">'
    )

    return html_con_tailwind
  }

  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const identitySDK = useIdentitySDK('production');

  const claimUBI = async () => {

    if (!session  || !address || session.address != address || 
        !publicClient || !walletClient || !identitySDK) {
      return (<div>Works only with wallet connected</div>)
    }
    const claimSDK = new ClaimSDK({
      account: session.address,
      publicClient,
      walletClient,
      identitySDK,
      env: 'production',
    });

    try {
      await claimSDK.claim();
      console.log('Claim successful');
    } catch (error) {
      console.error('Claim failed:', error);
    }
  }
  if (
    !course.sinBilletera && course.conBilletera && 
    (!session || !address || !session.address || session.address != address)
  ) {
    return <div className="mt-40">Connect Wallet</div>
  }

  return (
    <>
      <div className="mt-8 pt-2  dark:bg-gray-100 dark:text-gray-800">
        <div className="container p-2 px-8 md:px-16 mx-auto pt-16 space-y-1">
          <h3 className="pb-1 text-1xl font-bold md:text-1xl text-center">
            {course.idioma == 'en' ? "Course:" : "Curso:"}
            {course.titulo}
          </h3>
        </div>
        <h1 className="py-3 px-16 text-[2rem] font-bold text-left">
          { course.idioma == 'en' ? "Guide" : "Guía" }
          &nbsp;
          <span>{guideNumber}</span>: {myGuide.titulo}
        </h1>
        <div className="py-3 px-16 text-1xl md:text-1xl text-justify **:list-inside" dangerouslySetInnerHTML={{ __html: guideHtml }} />
        { isClient && pathPrefix == "gooddollar" && pathSuffix == "guide1" &&
          <div className="flex items-center justify-center">
            <button onClick={claimUBI}
              className="inline-flex items-center bg-gray-800 text-white py-2 px-3 hover:bg-secondary-100 hover:text-white"
          >Sign up with GoodDollar or Claim UBI</button>
          </div>
        }
    
        <table className="mx-auto text-center mt-12"><tbody>
          <tr>
            <td>
              { guideNumber > 1 &&
                (<a href={previousGuidePath} className="inline-flex items-center bg-gray-800 text-white border-r border-gray-100 py-2 px-2 hover:bg-secondary-100 hover:text-white">
                 { course.idioma == 'en' ? "Previous" : "Anterior" }
                </a>)
              }
              { guideNumber <= 1 &&
                (<div className="inline-flex items-center bg-gray-400 text-white border-r border-gray-100 py-2 px-2">
                 { course.idioma == 'en' ? "Previous" : "Anterior" }
                </div>)
              }
    
            </td>
            <td>
              <a href={coursePath} className="inline-flex items-center bg-gray-800 text-white py-2 px-2 hover:bg-secondary-100 hover:text-white">
                { course.idioma == 'en' ? "Start of Course" : "Inicio del Curso"}
              </a>
            </td>
            <td>
              &nbsp;
              { guideNumber < course.guias.length  && (
                <a href={nextGuidePath} className="inline-flex items-center bg-gray-800 text-white  py-2 px-2 hover:bg-secondary-100 hover:text-white">
                  {course.idioma == 'en' ? "Next" : "Siguiente"}
                </a>
              )}
              { guideNumber >= course.guias.length  && (
                <div className="inline-flex items-center bg-gray-400 text-white  py-2 px-3">
                  {course.idioma == 'en' ? "Next" : "Siguiente"}
                </div>
              )}
            </td>
          </tr>
        </tbody></table>
        { creditsHtml != '' && (
          <div className="text-sm mt-2">
            <h2 className="px-16 text-1xl font-bold md:text-1xl">
              { course.idioma == "en" ?
                "Credits and License of this course" :
                "Créditos y Licencia de este curso"
              }
            </h2>
            <div className="py-3 px-16 text-1xl md:text-1xl text-justify"
              dangerouslySetInnerHTML={{ __html: creditsHtml }} />
          </div>
        )}
      </div>

      <div>&nbsp;</div>
    </>
  )
}
