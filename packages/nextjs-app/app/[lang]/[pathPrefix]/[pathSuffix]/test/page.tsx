"use client"

import axios from 'axios'

import { useSession, getCsrfToken } from "next-auth/react"

import { use, useEffect, useState } from 'react'
import remarkDirective from 'remark-directive'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import {unified} from 'unified'
import { useAccount } from 'wagmi'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { remarkFillInTheBlank } from '@/lib/remarkFillInTheBlank.mjs'
import { cn } from "@/lib/utils"

interface WordPlacement {
  word: string
  row: number
  col: number
  direction: "across" | "down"
  number: number
  clue: string
}

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
  const { data: session } = useSession()

  const [course, setCourse] = useState({
    id: "",
    conBilletera: false,
    guias: [],
    idioma: "",
    titulo: "",
    sinBilletera: false,
  })
  const [guideNumber, setGuideNumber] = useState(0)
  const [myGuide, setMyGuide] = useState({
    titulo: "",
  })
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
  const [prevRow, setPrevRow] = useState(-1)
  const [prevCol, setPrevCol] = useState(-1)

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
      if (csrfToken) {
        setGCsrfToken(csrfToken)
      }
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
          const rcurso = response.data[0]

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
              const dcurso = responsed.data
              setCourse(dcurso)

              let gnumber = 0
              for(let g=0; g < dcurso.guias.length; g++) {
                if (dcurso.guias[g].sufijoRuta == (pathSuffix)) {
                  setGuideNumber(g + 1)
                  gnumber = g + 1
                  setThisGuidePath("/" + dcurso.idioma +
                                     dcurso.prefijoRuta + "/" + pathSuffix)
                  setMyGuide(dcurso.guias[g])
                }
              }

              setCreditsHtml(htmlDeMd(dcurso.creditosMd))

              let urlc = process.env.NEXT_PUBLIC_AUTH_URL + 
                `/api/crossword?courseId=${dcurso.id}` +
                `&lang=${lang}` +
                `&prefix=${pathPrefix}` +
                `&guide=${pathSuffix}` +
                `&guideNumber=${guideNumber}`
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
                console.error(error)
                alert(error)
              })
            }
          })
          .catch(error => {
            console.error(error)
            alert(error)
          })
        }
      })
      .catch(error => {
        console.error(error)
        alert(error)
      })
    }
    configurar()
  }, [session, address])


  const parameters = use(params)
  const { lang, pathPrefix, pathSuffix } = parameters

        const htmlDeMd = (md: string) => {
        const processor = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkDirective)
      .use(remarkFrontmatter)
      .use(remarkFillInTheBlank, { url: `${pathSuffix}/test` })
      // @ts-ignore
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
    if (value.length > 1) {
      return
    }

    const newGrid = [...grid]
    newGrid[row][col] = {
      ...newGrid[row][col],
      userInput: value.toUpperCase(),
    }
    setGrid(newGrid)

    if (value.length === 1) {
      let prevDirAcross = true
      if (prevRow >=0 && prevCol >= 0 &&
          prevRow == row - 1 && prevCol == col) {
        prevDirAcross = false
      }
      setPrevRow(row)
      setPrevCol(col)

      let dirAcross = prevDirAcross
      const currentCell = grid[row][col]
      const wordNumbers = currentCell.belongsToWords
      // If more than one word on this cell keep using previous direction
      if (wordNumbers.length ==  1) {
        const placement = placements.find((p) => p.number === wordNumbers[0])
        if (placement) {
          dirAcross = placement.direction === "across"
        }
      }

      // Calculate next position
      let nextRow =
        dirAcross ? row : row + 1
      let nextCol =
        dirAcross ? col + 1 : col

      // If next position is part of the word
      if (nextRow < grid.length && nextCol < grid[nextRow].length &&
          !grid[nextRow][nextCol].isBlocked) {
        // If next position is empty we just focus on it
        // but if it is part of an existing word we suppose it is correct
        // and try to skip it
        if (grid[nextRow][nextCol].userInput != '') {
          const sNextRow =
            dirAcross ? nextRow : nextRow + 1
          const sNextCol =
            dirAcross ? nextCol + 1 : nextCol
          if (sNextRow < grid.length && sNextCol < grid[sNextRow].length &&
              !grid[sNextRow][sNextCol].isBlocked) {
            nextRow = sNextRow
            nextCol = sNextCol
          }
        }
        // Focus the next input
        const nextInput = document.querySelector(
          `input[data-row="${nextRow}"][data-col="${nextCol}"]`,
        ) as HTMLInputElement
        if (nextInput) {
          nextInput.focus()
        }
      }
    }
  }

  // Check if puzzle is solved
  const isPuzzleCompleted = () => {
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
    interface CrosswordData {
      courseId: number
      guideId: number
      lang: string
      prefix: string
      guide: string
      grid: Cell[][]
      placements: WordPlacement[]
      walletAddress?: string
      token?: string
    }

    let data: CrosswordData = {
      courseId: +course.id,
      guideId: guideNumber,
      lang: lang,
      prefix: pathPrefix,
      guide:  pathSuffix,
      grid: grid,
      placements: placements
    }
    if (session && address && session.address &&
        session.address == address) {
      data.walletAddress = session.address
      data.token = gCsrfToken
    }
    console.log(`Fetching ${urlc}`)
    axios.post(urlc, data, {
      headers: {
        'Content-Type': 'application/json'
      }
    })
    .then(response => {
      console.log(response)
      if (response.data) {
        // Mensajes localizados
        const locale = lang === "en" ? "en" : "es"
        const uiMsg = {
          es: {
            problemWords: "Problema(s) con la(s) palabra(s) ",
            scholarshipSent: "\nResultado de beca enviado: ",
            connectWallet: "Conectar billetera",
            crossword: "Crucigrama",
            submit: "Enviar respuesta",
            across: "Horizontal",
            down: "Vertical",
            returnGuide: "Regresar a la guía",
            credits: "Créditos y Licencia de este curso"
          },
          en: {
            problemWords: "Problem(s) with word(s) ",
            scholarshipSent: "\nScholarship result sent: ",
            connectWallet: "Connect Wallet",
            crossword: "Crossword Puzzle",
            submit: "Submit answer",
            across: "Across",
            down: "Down",
            returnGuide: "Return to guide",
            credits: "Credits and License of this course"
          }
        }
        if (response.data.mistakesInCW && response.data.mistakesInCW.length > 0) {
          setFlashError(uiMsg[locale].problemWords + response.data.mistakesInCW.join(", "))
        } else {
          let msg = response.data.message || ""
          let scholarship = response.data.scholarshipResult
          if (scholarship) {
            setFlashSuccess(msg + uiMsg[locale].scholarshipSent + JSON.stringify(scholarship))
          } else {
            setFlashSuccess(msg)
          }
        }
      }
    })
    .catch(error => {
      console.error(error)
      alert(error)
    })
  }

  const locale = lang === "en" ? "en" : "es"
  const uiMsg = {
    es: {
      connectWallet: "Conectar billetera",
      crossword: "Crucigrama",
      submit: "Enviar respuesta",
      across: "Horizontal",
      down: "Vertical",
      returnGuide: "Regresar a la guía",
      credits: "Créditos y Licencia de este curso"
    },
    en: {
      connectWallet: "Connect Wallet",
      crossword: "Crossword Puzzle",
      submit: "Submit answer",
      across: "Across",
      down: "Down",
      returnGuide: "Return to guide",
      credits: "Credits and License of this course"
    }
  }
  if (
    !course.sinBilletera && course.conBilletera && 
    (!session || !address || !session.address || session.address != address)
  ) {
    return <div className="mt-40">{uiMsg[locale].connectWallet}</div>
  }

  const acrossClues = placements.filter((p) => p.direction === "across")
  const downClues = placements.filter((p) => p.direction === "down")

  return (
    <>
      <div className="mt-8 pt-2  dark:bg-gray-100 dark:text-gray-800">
        <div className="container p-2 px-8 md:px-16 mx-auto pt-16 space-y-1">
          <h3 className="pb-1 text-1xl font-bold md:text-1xl text-center">
            {locale === 'en' ? "Course: " : "Curso: "}
            {course.titulo}
          </h3>
        </div>
        <h1 className="py-3 px-16 text-[2rem] font-bold text-left">
          { locale === 'en' ? "Guide" : "Guía" }
          &nbsp;
          <span>{guideNumber}</span>: {myGuide.titulo}
        </h1>
        <div className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Crossword Grid */}
            <div className="lg:col-span-2 overflow-x-auto">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div>{uiMsg[locale].crossword}</div>
                    {isPuzzleCompleted() && 
                      <div>
                        <Button className="text-primary-foreground!" onClick={handleSubmit}>{uiMsg[locale].submit}</Button>
                      </div>
                    }
                    {!isPuzzleCompleted() && 
                      <div>
                        <Button disabled={true} className="primary">{uiMsg[locale].submit}</Button>
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
                                  data-row={rowIndex}
                                  data-col={colIndex}
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
                  <CardTitle>{uiMsg[locale].across}</CardTitle>
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
                  <CardTitle>{uiMsg[locale].down}</CardTitle>
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
              <Button asChild>
                <a className="text-primary-foreground!" href={thisGuidePath}>
                  { uiMsg[locale].returnGuide }
                </a>
              </Button>
            </td>
          </tr>
        </tbody></table>
        { creditsHtml != '' && (
          <div className="text-sm mt-2">
            <h2 className="px-16 text-1xl font-bold md:text-1xl">
              { uiMsg[locale].credits }
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
