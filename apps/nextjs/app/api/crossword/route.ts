'use server'

import clg from 'crossword-layout-generator-with-isolated'
import { readFile } from 'fs/promises'
import { Kysely, PostgresDialect, Updateable } from 'kysely'
import { NextRequest, NextResponse } from 'next/server'
import remarkDirective from 'remark-directive'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import { Pool } from 'pg'
import { unified } from 'unified'

import type { DB, BilleteraUsuario } from '@/db/db.d.ts'
import { newKyselyPostgresql } from '@/.config/kysely.config'
import { recordEvent } from '@/lib/metrics-server'
import { getGuideIdBySuffix } from '@/lib/guide-utils'
import { remarkFillInTheBlank } from '@/lib/remarkFillInTheBlank.mjs'

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

export async function GET(req: NextRequest) {
  console.log('** crossword GET req=', req)

  const initializeGrid = (rows: number, cols: number): Cell[][] => {
    return Array(rows)
      .fill(null)
      .map(() =>
        Array(cols)
          .fill(null)
          .map(() => ({
            letter: '',
            isBlocked: true,
            userInput: '',
            belongsToWords: [],
          })),
      )
  }

  try {
    let retMessage = ''

    const { searchParams } = req.nextUrl
    const courseId = searchParams.get('courseId')
    const lang = searchParams.get('lang')
    const prefix = searchParams.get('prefix')
    const guide = searchParams.get('guide')
    const walletAddress = searchParams.get('walletAddress')
    const token = searchParams.get('token')

    console.log('[crossword API] Parameters:', {
      courseId,
      lang,
      prefix,
      guide,
      walletAddress: walletAddress ? `${walletAddress.substring(0, 10)}...` : 'null',
      tokenLength: token?.length || 0
    })

    // Calculate actual guideId for metrics
    let actualGuideId = 0
    if (courseId && guide) {
      try {
        const guideId = await getGuideIdBySuffix(parseInt(courseId), guide)
        if (guideId !== null) {
          actualGuideId = guideId
        }
      } catch (error) {
        console.error('Error calculating guideId for metrics:', error)
      }
    }

    let newGrid = initializeGrid(15, 15)
    const newPlacements: WordPlacement[] = []

    const db = newKyselyPostgresql()

    let billeteraUsuario: any = null
    if (!walletAddress || walletAddress == null || walletAddress == '') {
      retMessage += '\nTo solve the puzzle, please connect your web3 Wallet. '
    } else {
      billeteraUsuario = await db
        .selectFrom('billetera_usuario')
        .where('billetera', '=', walletAddress)
        .selectAll()
        .executeTakeFirst()
      if (billeteraUsuario && billeteraUsuario.token != token) {
        retMessage += "\nToken stored for user doesn't match given token. "
      }
    }
    if (retMessage == '') {
      // Record game start event if user is authenticated
      if (billeteraUsuario?.usuario_id) {
        try {
          await recordEvent({
            event_type: 'game_start',
            event_data: {
              gameType: 'crossword',
              guideId: actualGuideId,
            },
            usuario_id: billeteraUsuario.usuario_id,
          })
        } catch (error) {
          console.error('Failed to record game_start event:', error)
        }
      }
      let wordNumber = 1

      console.log('** cwd=', process.cwd())
      let fname = `../../resources/${lang}/${prefix}/${guide}.md`
      console.log('** fname=', fname)
      let md = await readFile(fname, 'utf8')
      console.log(md)

      let processor = unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkDirective)
        .use(remarkFrontmatter)
        .use(remarkFillInTheBlank, { url: '' })
        // @ts-ignore
        .use(remarkRehype, { allowDangerousHtml: true })
        .use(rehypeStringify, { allowDangerousHtml: true })
      let html = processor.processSync(md).toString()

      let qa = (global as any).fillInTheBlank || []

      let scrambled = []
      let words = []
      while (qa.length > 0) {
        let np = Math.floor(Math.random() * qa.length)
        scrambled.push(qa[np])
        words.push(qa[np].answer)
        qa.splice(np, 1)
      }
      console.log('scrambled=', scrambled)
      if (scrambled.length > 0) {
        // Save in Database
        let layout = clg.generateLayout(scrambled)
        console.log('** layout=', layout)
        let rows = layout.rows
        let cols = layout.cols
        console.log('** rows=', rows)
        console.log('** cols=', cols)
        newGrid = initializeGrid(rows, cols)
        let table = layout.table // table as two-dimensional array
        console.log('** table=', table)
        let output_html = layout.table_string // table as plain text (with HTML line breaks)
        console.log('** output_html=', output_html)
        let output_json = layout.result
        console.log('** output_json=', output_json)

        for (let index = 0; index < output_json.length; index++) {
          let word = output_json[index].answer
          let clue = output_json[index].clue
          let row = output_json[index].starty - 1
          let col = output_json[index].startx - 1
          let direction = output_json[index].orientation
          if (direction == 'down' || direction == 'across') {
            for (let i = 0; i < word.length; i++) {
              const currentRow = direction === 'down' ? row + i : row
              const currentCol = direction === 'across' ? col + i : col
              console.log(
                '** currentRow=',
                currentRow,
                ', currentCol=',
                currentCol,
              )
              let ebelongs =
                typeof newGrid[currentRow][currentCol] == 'undefined'
                  ? []
                  : newGrid[currentRow][currentCol].belongsToWords
              newGrid[currentRow][currentCol] = {
                letter: '', // Originally word[i] but we don't send answer
                number:
                  i === 0
                    ? wordNumber
                    : typeof newGrid[currentRow][currentCol] != 'undefined'
                      ? newGrid[currentRow][currentCol].number
                      : -1,
                isBlocked: false,
                userInput: '',
                belongsToWords: ebelongs.concat(wordNumber),
              }
            }
            newPlacements.push({
              word: '-',
              row: row,
              col: col,
              direction: direction,
              number: wordNumber,
              clue: clue,
            })
            wordNumber++
          }
        }
        console.log('** newPlacements=', newPlacements)
      }

      let now = new Date()
      let uWalletUser: Updateable<BilleteraUsuario> = {
        answer_fib: words.join(' | '),
        updated_at: now,
      }
      let rUpdate = await db
        .updateTable('billetera_usuario')
        .set(uWalletUser)
        .where('id', '=', billeteraUsuario?.id)
        .execute()
      console.log(new Date(), 'After update rUpdate=', rUpdate)
    }

    console.log('** newGrid=', newGrid)
    return NextResponse.json(
      {
        grid: newGrid,
        placements: newPlacements,
        message: retMessage,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Excepción error=', error)
    return NextResponse.json({ error: error }, { status: 500 })
  }
}
