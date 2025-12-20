'use client'

import axios, { AxiosError } from 'axios'
import { getCsrfToken, useSession } from 'next-auth/react'
import { use, useEffect, useState } from 'react'
import { useAccount, useConfig, useWriteContract } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'

import { useGuideData } from '@/lib/hooks/useGuideData'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface WordPlacement {
  word: string
  row: number
  col: number
  direction: 'across' | 'down'
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
  const { data: hash } = useWriteContract()
  const wagmiConfig = useConfig()
  const parameters = use(params)
  const { lang, pathPrefix, pathSuffix } = parameters

  const { 
    course, 
    loading, 
    error, 
    myGuide, 
    guideNumber 
  } = useGuideData({ lang, pathPrefix, pathSuffix })

  const [thisGuidePath, setThisGuidePath] = useState('')
  const [grid, setGrid] = useState<Cell[][]>([])
  const [placements, setPlacements] = useState<WordPlacement[]>([])
  const [flashError, setFlashError] = useState('')
  const [flashSuccess, setFlashSuccess] = useState('')
  const [flashWarning, setFlashWarning] = useState('')
  const [scholarshipTx, setScholarshipTx] = useState('')
  const [gCsrfToken, setGCsrfToken] = useState('')
  const [prevRow, setPrevRow] = useState(-1)
  const [prevCol, setPrevCol] = useState(-1)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (hash) {
      const locale = lang === 'es' ? 'es' : 'en'
      const uiMsg = {
        es: {
          txProcessing: 'Procesando transacción...',
        },
        en: {
          txProcessing: 'Processing transaction...',
        },
      }
      setFlashWarning(uiMsg[locale].txProcessing)

      waitForTransactionReceipt(wagmiConfig, { hash }).
        then((receipt) => {
          console.log('Transaction receipt', receipt)
          // Actualizar el estado de la guía localmente para reflejar el pago
          if (myGuide) {
            myGuide.receivedScholarship = true 
          }
          setFlashWarning('')
      }).catch((e: Error) => {
        console.error(e)
        setFlashError(e.message)
        setFlashWarning('')
      })
    }
  }, [hash, wagmiConfig, lang, myGuide])

  useEffect(() => {
    const loadCrossword = async () => {
      if (course && guideNumber > 0 && address && session) {
        try {
          const csrfToken = await getCsrfToken()
          if (!csrfToken) throw new Error('Could not get CSRF token')
          setGCsrfToken(csrfToken)

          const urlc =
            `/api/crossword?courseId=${course.id}` +
            `&lang=${lang}` +
            `&prefix=${pathPrefix}` +
            `&guide=${pathSuffix}` +
            `&guideNumber=${guideNumber}` +
            `&walletAddress=${address}` +
            `&token=${csrfToken}`

          console.log(`Fetching Crossword: ${urlc}`)
          const response = await axios.get<{grid: Cell[][], placements: WordPlacement[], message?: string}>(urlc)

          if (response.data.message) {
            throw new Error(response.data.message)
          }
          setGrid(response.data.grid)
          setPlacements(response.data.placements)
          setThisGuidePath(`/${lang}/${pathPrefix}/${pathSuffix}`)
        } catch (err) {
            if (err instanceof AxiosError) {
                console.error(err)
                setFlashError(err.message)
            }
        }
      }
    }
    loadCrossword()
  }, [course, guideNumber, address, session, lang, pathPrefix, pathSuffix])

  const handleCellInput = (row: number, col: number, value: string) => {
    if (value.length > 1) return

    const newGrid = [...grid]
    newGrid[row][col] = { ...newGrid[row][col], userInput: value.toUpperCase() }
    setGrid(newGrid)

    if (value.length === 1) {
      let prevDirAcross = true
      if (prevRow >= 0 && prevCol >= 0 && prevRow === row - 1 && prevCol === col) {
        prevDirAcross = false
      }
      setPrevRow(row)
      setPrevCol(col)

      let dirAcross = prevDirAcross
      const currentCell = grid[row][col]
      const wordNumbers = currentCell.belongsToWords
      if (wordNumbers.length === 1) {
        const placement = placements.find((p) => p.number === wordNumbers[0])
        if (placement) {
          dirAcross = placement.direction === 'across'
        }
      }

      let nextRow = dirAcross ? row : row + 1
      let nextCol = dirAcross ? col + 1 : col

      if (
        nextRow < grid.length &&
        nextCol < grid[nextRow].length &&
        !grid[nextRow][nextCol].isBlocked
      ) {
        if (grid[nextRow][nextCol].userInput !== '') {
          const sNextRow = dirAcross ? nextRow : nextRow + 1
          const sNextCol = dirAcross ? nextCol + 1 : nextCol
          if (
            sNextRow < grid.length &&
            sNextCol < grid[sNextRow].length &&
            !grid[sNextRow][sNextCol].isBlocked
          ) {
            nextRow = sNextRow
            nextCol = sNextCol
          }
        }
        const nextInput = document.querySelector(
          `input[data-row="${nextRow}"][data-col="${nextCol}"]`,
        ) as HTMLInputElement
        if (nextInput) {
          nextInput.focus()
        }
      }
    }
  }

  const isPuzzleCompleted = () => {
    if (grid.length === 0) return false
    return grid.every((row) =>
      row.every((cell) => cell.isBlocked || cell.userInput !== ''),
    )
  }

  const handleSubmit = async () => {
    if (!course) return
    setIsSubmitting(true)
    setFlashSuccess('')
    setFlashError('')
    setFlashWarning('')
    setScholarshipTx('')

    try {
      const response = await axios.post<{mistakesInCW: [], message: string, scholarshipResult: string}>('/api/check-crossword', {
        courseId: +course.id,
        guideId: guideNumber,
        lang: lang,
        grid: grid,
        placements: placements,
        walletAddress: address || '0x0',
        token: gCsrfToken,
      })

      const locale = lang === 'en' ? 'en' : 'es'
      const uiMsg = {
        es: { problemWords: 'Problema(s) con la(s) palabra(s) ' },
        en: { problemWords: 'Problem(s) with word(s) ' },
      }

      if (response.data.mistakesInCW?.length > 0) {
        setFlashError(
          uiMsg[locale].problemWords +
            response.data.mistakesInCW.join(', ') +
            '\n' +
            (response.data.message || ''),
        )
      } else {
        if (myGuide) {
          myGuide.completed = true
        }
        setFlashSuccess(response.data.message || '')
        if (response.data.scholarshipResult) {
          setScholarshipTx(response.data.scholarshipResult)
        }
      }
    } catch (error) {
        if (error instanceof AxiosError) {
            console.error(error)
            setFlashError(error.response?.data?.error || error.message)
        }
    } finally {
      setIsSubmitting(false)
    }
  }

  const locale = lang === 'en' ? 'en' : 'es'
  const uiMsg = {
    es: {
      across: 'Horizontal',
      connectWallet: 'Conectar billetera',
      crossword: 'Crucigrama',
      down: 'Vertical',
      returnGuide: 'Regresar a la guía',
      scholarshipPaid: 'La beca para este crucigrama ya ha sido pagada. Puedes resolverlo de nuevo, pero no recibirás otro pago.',
      sending: 'Enviando...',
      submit: 'Enviar respuesta',
    },
    en: {
      across: 'Across',
      connectWallet: 'Connect Wallet',
      crossword: 'Crossword Puzzle',
      down: 'Down',
      returnGuide: 'Return to guide',
      scholarshipPaid: 'The scholarship for this crossword has already been paid. You can solve it again, but you will not receive another payment.',
      sending: 'Sending...',
      submit: 'Submit answer',
    },
  }

  if (loading) {
    return <div className="p-10 mt-10">Loading test...</div>
  }

  if (error) {
    return <div className="p-10 mt-10">Error: {error}</div>
  }

  if (!course || !myGuide) {
    return <div className="p-10 mt-10">Test not found.</div>
  }

  if (
    !course.sinBilletera &&
    course.conBilletera &&
    (!session || !address || session.address !== address)
  ) {
    return <div className="mt-40">{uiMsg[locale].connectWallet}</div>
  }

  const acrossClues = placements.filter((p) => p.direction === 'across')
  const downClues = placements.filter((p) => p.direction === 'down')

  return (
    <>
      <div className="mt-8 pt-2 dark:bg-gray-100 dark:text-gray-800">
        <div className="container p-2 px-8 md:px-16 mx-auto pt-16 space-y-1">
          <h3 className="pb-1 text-1xl font-bold md:text-1xl text-center">
            {locale === 'en' ? 'Course: ' : 'Curso: '}
            {course.titulo}
          </h3>
        </div>
        <h1 className="py-3 px-16 text-[2rem] font-bold text-left">
          {locale === 'en' ? 'Guide' : 'Guía'}
          &nbsp;
          <span>{guideNumber}</span>: {myGuide.titulo}
          {myGuide.completed ? ' ✅' : ''}
          {myGuide.receivedScholarship ? ' 💰' : ''}
        </h1>
        <div className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 overflow-x-auto">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div>{uiMsg[locale].crossword}</div>
                    <Button
                      onClick={handleSubmit}
                      disabled={isSubmitting || !isPuzzleCompleted() || myGuide.receivedScholarship}
                    >
                      {isSubmitting ? uiMsg[locale].sending : uiMsg[locale].submit}
                    </Button>
                  </CardTitle>
                  {myGuide.receivedScholarship && (
                    <div className="p-4 mb-4 text-sm text-blue-700 bg-blue-100 rounded-lg dark:bg-blue-200 dark:text-blue-800">
                      {uiMsg[locale].scholarshipPaid}
                    </div>
                  )}

                  {flashError && (
                    <div
                      className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-200 dark:text-red-800 break-all whitespace-pre-wrap"
                      onClick={() => setFlashError('')}
                    >
                      {flashError}
                    </div>
                  )}
                   {flashWarning != '' && (
                    <div
                      className="p-4 mb-4 text-sm text-yellow-700 bg-yellow-100 rounded-lg dark:bg-yellow-200 dark:text-yellow-800 break-all whitespace-pre-wrap"
                      onClick={() => setFlashWarning('')}
                    >
                      {flashWarning}
                    </div>
                  )}
                  {flashSuccess != '' && (
                    <div
                      className="p-4 mb-4 text-sm text-green-700 bg-green-100 rounded-lg dark:bg-green-200 dark:text-green-800 break-all whitespace-pre-wrap"
                      onClick={() => setFlashSuccess('')}
                    >
                      {flashSuccess}
                    </div>
                  )}
                  {scholarshipTx && (
                    <div className="p-4 mb-4 text-sm text-green-700 bg-green-100 rounded-lg dark:bg-green-200 dark:text-green-800 break-all">
                      <a
                        href={`${process.env.NEXT_PUBLIC_EXPLORER_TX}${scholarshipTx}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        {scholarshipTx}
                      </a>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="grid gap-1 p-4 bg-muted rounded-lg overflow-auto">
                    {grid.map((row, rowIndex) => (
                      <div key={rowIndex} className="flex gap-1">
                        {row.map((cell, colIndex) => (
                          <div
                            key={`${rowIndex}-${colIndex}`}
                            className={cn(
                              'w-8 h-8 border border-border relative',
                              !cell || cell.isBlocked ? 'bg-black' : 'bg-white dark:bg-background',
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
                                  onChange={(e) =>
                                    handleCellInput(rowIndex, colIndex, e.target.value)
                                  }
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
        <table className="mx-auto text-center mt-12">
          <tbody>
            <tr>
              <td>
                <Button asChild>
                  <a className="text-primary-foreground!" href={thisGuidePath}>
                    {uiMsg[locale].returnGuide}
                  </a>
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div>&nbsp;</div>
    </>
  )
}

