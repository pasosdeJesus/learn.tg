"use client"

import axios from 'axios';

import { ClaimSDK, useIdentitySDK } from '@goodsdks/citizen-sdk';
import { useSession, getCsrfToken } from "next-auth/react"
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

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { remarkFillInTheBlank } from '@/lib/remarkFillInTheBlank.mjs'
import { cn } from "@/lib/utils"

interface Cell {
  letter: string
  number?: number
  isBlocked: boolean
  userInput: string
  belongsToWords: number[]
}

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
  const [thisGuidePath, setThisGuidePath] = useState("")
  const [guideHtml, setGuideHtml] = useState("")
  const [creditsHtml, setCreditsHtml] = useState("")
  const [isClient, setIsClient] = useState(false)
  const [grid, setGrid] = useState<Cell[][]>([])
  const [placements, setPlacements] = useState<WordPlacement[]>([])
  const [flashError, setFlashError] = useState("")
  const [flashSuccess, setFlashSuccess] = useState("")
  const [gCsrfToken, setGCsrfToken] = useState("")

  useEffect(() => {
    if ((session && !address) || (address && !session) || 
        (address && session && session.address && 
         address != session.address)) {
      return
    }
    const configurar = async () => {
      setIsClient(true)
      setCoursePath(`/${lang}/${pathPrefix}`)
      let url = `${process.env.NEXT_PUBLIC_API_BUSCA_CURSOS_URL}?` +
        `filtro[busprefijoRuta]=/${pathPrefix}&` +
        `filtro[busidioma]=${lang}`
      let csrfToken = await getCsrfToken()
      setGCsrfToken(csrfToken)
      if (session && address && session.address &&
          session.address == address) {
        url += `&walletAddress=${session.address}` +
          `&token=${csrfToken}`
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
          if (session && address && session.address &&
              session.address == address) {
            urld += `&walletAddress=${session.address}` +
              `&token=${csrfToken}`
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
                  setThisGuidePath("/" + dcurso.idioma +
                                     dcurso.prefijoRuta + "/" + pathSuffix)
                  setMyGuide(dcurso.guias[g])
                }
              }

              setCreditsHtml(htmlDeMd("", dcurso.creditosMd))

              let urlc = process.env.NEXT_PUBLIC_AUTH_URL + 
                `/api/crossword?guideId=${dcurso.id}` +
                `&lang=${lang}` +
                `&prefix=${pathPrefix}` +
                `&guide=${pathSuffix}`
              if (session && address && session.address &&
                  session.address == address) {
                urlc += `&walletAddress=${session.address}` +
                  `&token=${csrfToken}`
              }

              console.log(`Fetching ${urlc}`)
              axios.get(urlc)
              .then(response => {
                if (response.data) {
                  if (response.data.message != "") {
                    alert(response.data.message)
                  } else {
                    setGrid(response.data.grid)
                    setPlacements(response.data.placements)
                  }
                }
              })
              .catch(error => {
                console.error(error);
                alert(error);
              })
            }
          })
          .catch(error => {
            console.error(error);
            alert(error);
          })
        }
      })
      .catch(error => {
        console.error(error);
        alert(error);
      })
    }
    configurar()
  }, [session, address])


  const parameters = use(params)
  const { lang, pathPrefix, pathSuffix } = parameters

  let htmlDeMd = (suffix, md: string) => {
    let processor = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkDirective)
      .use(remarkFrontmatter)
      .use(remarkFillInTheBlank, { url: `${suffix}/test` })
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeStringify, { allowDangerousHtml: true })
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

  // Handle user input
  const handleCellInput = (row: number, col: number, value: string) => {
    if (value.length > 1) return

      const newGrid = [...grid]
      newGrid[row][col] = {
        ...newGrid[row][col],
        userInput: value.toUpperCase(),
      }
      setGrid(newGrid)
  }

  // Check if puzzle is solved
  const isPuzzleSolved = () => {
    if (grid.length == 0) {
      return false
    }
    return grid.every(
      (row) => row.every(
        (cell) => cell.isBlocked || cell.userInput != ''
      )
    )
  }

  const handleSubmit = () => {
    setFlashSuccess("")
    setFlashError("")
    console.log(grid)
    console.log(placements.length)

    let urlc = process.env.NEXT_PUBLIC_AUTH_URL + 
      `/api/check_crossword`
       if (session && address && session.address &&
        session.address == address) {
      urlc += `&walletAddress=${session.address}` +
      `&token=${gCsrfToken}`
    }
    console.log(`Fetching ${urlc}`)
    axios.post(urlc,{
      guideId: course.id,
      lang: lang,
      prefix: pathPrefix,
      guide:  pathSuffix,
      grid: grid,
      placements: placements
    })
    .then(response => {
      if (response.data) {
        if (response.data.probs && response.data.probs != []) {
          setFlashError("Problem(s) with word(s) " + probs.join(", "))
        } else if (response.data.message) {
          setFlashError("Problem: " + response.data.message)
        } else {
          setFlashSuccess("Perfect, however this course doesn't have scolarships active in this moment")
        }
      }
    })
    .catch(error => {
      console.error(error);
      alert(error);
    })
  }

  if (
    !course.sinBilletera && course.conBilletera && 
    (!session || !address || !session.address || session.address != address)
  ) {
    return <div className="mt-40">Connect Wallet</div>
  }

  const acrossClues = placements.filter((p) => p.direction === "across")
  const downClues = placements.filter((p) => p.direction === "down")

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
        <div className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Crossword Grid */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div>Crossword Puzzle</div>
                    {isPuzzleSolved() && 
                      <div>
                        <Button className="bg-gray-600" onClick={handleSubmit}>Submit answer</Button>
                      </div>
                    }
                    {!isPuzzleSolved() && 
                      <div>
                        <Button disabled="disabled" className="bg-gray-600">Submit answer</Button>
                      </div>
                    }
                  </CardTitle>

                  {flashError != "" && <div className="bg-red-500">{flashError}</div>}
                  {flashSuccess != "" && <div className="bg-green-500">{flashSuccess}</div>}
                </CardHeader>
                <CardContent>
                  <div className="grid gap-1 p-4 bg-muted rounded-lg overflow-auto">
                    {grid.map((row, rowIndex) => (
                      <div key={rowIndex} className="flex gap-1">
                        {row.map((cell, colIndex) => (
                          <div
                            key={`${rowIndex}-${colIndex}`}
                            className={cn(
                              "w-8 h-8 border border-border relative",
                              (!cell || cell.isBlocked) ? 
                                "bg-black" : "bg-white dark:bg-background",
                            )}
                          >
                            {cell && !cell.isBlocked && (
                              <>
                                {cell.number && (
                                  <span className="absolute top-0 left-0 text-xs font-bold leading-none p-0.5">
                                    {cell.number}
                                  </span>
                                )}
                                <input
                                  type="text"
                                  value={cell.userInput}
                                  onChange={(e) => handleCellInput(rowIndex, colIndex, e.target.value)}
                                  className="w-full h-full text-center text-sm font-bold border-none outline-none bg-transparent"
                                  maxLength={1}
                                />
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
    
            {/* Clues */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Across</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {acrossClues.map((placement) => (
                    <div key={`across-${placement.number}`} className="text-sm">
                      <span className="font-bold">{placement.number}.</span> {placement.clue}
                    </div>
                  ))}
                </CardContent>
              </Card>
    
              <Card>
                <CardHeader>
                  <CardTitle>Down</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {downClues.map((placement) => (
                    <div key={`down-${placement.number}`} className="text-sm">
                      <span className="font-bold">{placement.number}.</span> {placement.clue}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
        <table className="mx-auto text-center mt-12"><tbody>
          <tr>
            <td>
                <a href={thisGuidePath} className="inline-flex items-center bg-gray-800 text-white border-r border-gray-100 py-2 px-2 hover:bg-secondary-100 hover:text-white">
                 { course.idioma == 'en' ? "Return to guide" : "Regresar a la guía" }
                </a>
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
