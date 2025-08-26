"use server"

import clg from "crossword-layout-generator-with-isolated"
import { readFile } from 'fs/promises'
import { Insertable, Kysely, PostgresDialect, sql, Updateable } from 'kysely';
import { NextRequest, NextResponse } from 'next/server'
import remarkDirective from 'remark-directive'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import {unified} from 'unified'

import defineConfig from '@/.config/kysely.config.ts'
import type { DB, BilleteraUsuario, Usuario } from '@/db/db.d.ts';
import { remarkFillInTheBlank } from '@/lib/remarkFillInTheBlank.mjs'

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


export async function POST(req: NextRequest) {
  console.log("** check_crossword POST req=", req)

  try {
    let prob = [] 

    const requestJson = await req.json()
    console.log("OJO request.json()=", requestJson)
    const guideId = requestJson['guideId'] ?? ''
    console.log('OJO guideId=', guideId)
    const lang = requestJson['lang '] ?? ''
    console.log('OJO lang=', lang)
    const prefix = requestJson['prefix '] ?? ''
    console.log('OJO prefix=', prefix)
    const guide = requestJson['guide '] ?? ''
    console.log('OJO guide=', guide)
    const grid = requestJson['grid '] ?? ''
    console.log('OJO grid=', grid)
    const placements = requestJson['placements '] ?? ''
    console.log('OJO placements=', placements)
    const walletAddress = requestJson['walletAddress '] ?? ''
    console.log('OJO walletAddress=', walletAddress)
    const token = requestJson['token '] ?? ''
    console.log('OJO token=', token)

    const db = new Kysely<DB>({
      dialect: defineConfig.dialect
    })

    if (!walletAddress || walletAddress == null || walletAddress == "") {
      retMessage += "\nThe answer will not be graded nor will possible scholarships be sought. "
    } else {
      let billeteraUsuario = await db.selectFrom('billetera_usuario')
        .where('billetera', '=', walletAddress)
        .selectAll()
        .executeTakeFirst()
        if (billeteraUsuario.token != token) {
          retMessage += "\nToken stored for user doesn't match given token. "
        }
    }
    if (retMessage == "") {
      let wordNumber = 1

      let words = billeteraUsuario.words.split(" | ")
      console.log(words.length)
      let probs = []
      for(let i = 0; i < words.length; i++) {
        let nrow = placements[i].row
        let ncol = placements[i].col
        let dir = placements[i].direction
        let word = words[i]
        for (let j = 0; j < word.length; j++) {
          if (
            nrow >= grid.length || ncol >= grid[nrow].length ||
            grid[nrow][ncol].userInput.toUpperCase() != word[j].toUpperCase()
          ) {
            console.log(
              "Problema en i",i, "-esima palabra word=", word, 
              ", posición j=", j, ", se esperaba =", word[j].toUpperCase(),
              "se obtuvo",grid[nrow][ncol].userInput.toUpperCase()
            )
            if (!probs.includes(i+1)) {
              probs.push(i+1)
            }
          }
          if (dir == "across") {
            ncol++
          } else {
            nrow++
          }
        }
      }
    }

    return NextResponse.json(
      {
        probs: probs,
        message: retMessage
      },
      {status: 200}
    )
  } catch (error) {
    console.error("Excepción error=", error)
    return NextResponse.json(
      {error: error},
      {status: 500}
    )
  }

}
