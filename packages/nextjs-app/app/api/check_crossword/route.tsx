"use server"

import { Kysely } from 'kysely';
import { NextRequest, NextResponse } from 'next/server'

import defineConfig from '@/.config/kysely.config.ts'
import type { DB } from '@/db/db.d.ts';

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


export async function GET(req: NextRequest) {
  return NextResponse.json(
    {error: "Expecting POST request"},
    {status: 400}
  )
}

export async function POST(req: NextRequest) {
  console.log("** OJO check_crossword POST")
  console.log(1/0)

  let retMessage = ""
  const removeAccents = (s) => s.replace('á', 'A').
    replace('é', 'E').
    replace('í', 'I').
    replace('ó', 'O').
    replace('ú', 'U').
    replace('ü', 'U').
    replace('Á', 'A').
    replace('É', 'E').
    replace('Ó', 'O').
    replace('Ú', 'U').
    replace('Ü', 'U')

  try {
    let probs = [] 

    const requestJson = await req.json()
    console.log("OJO request.json()=", requestJson)
    const guideId = requestJson['guideId'] ?? ''
    console.log('OJO guideId=', guideId)
    const lang = requestJson['lang'] ?? ''
    console.log('OJO lang=', lang)
    const prefix = requestJson['prefix'] ?? ''
    console.log('OJO prefix=', prefix)
    const guide = requestJson['guide'] ?? ''
    console.log('OJO guide=', guide)
    const grid = requestJson['grid'] ?? ''
    console.log('OJO grid=', grid)
    const placements = requestJson['placements'] ?? ''
    console.log('OJO placements=', placements)
    const walletAddress = requestJson['walletAddress'] ?? ''
    console.log('OJO walletAddress=', walletAddress)
    const token = requestJson['token'] ?? ''
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
      if (!billeteraUsuario || billeteraUsuario.token != token) {
        retMessage += "\nToken stored for user doesn't match given token. "
      } else {
        console.log("billeteraUsuario=", billeteraUsuario)
        let wordNumber = 1

        let words = billeteraUsuario.answer_fib ?
          billeteraUsuario.answer_fib.split(" | ") : []
        console.log(words.length)
        for(let i = 0; i < words.length; i++) {
          let nrow = placements[i].row
          let ncol = placements[i].col
          let dir = placements[i].direction
          let word = words[i]
          for (let j = 0; j < word.length; j++) {
            if (
              nrow >= grid.length || ncol >= grid[nrow].length ||
              removeAccents(grid[nrow][ncol].userInput.toUpperCase()) != 
            removeAccents(word[j].toUpperCase())
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
