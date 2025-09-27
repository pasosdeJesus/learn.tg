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
import remarkStringify from 'remark-stringify'
import {unified} from 'unified'

import defineConfig from '@/.config/kysely.config.ts'
import type { DB, BilleteraUsuario, Usuario } from '@/db/db.d.ts';
import { remarkFillInTheBlank } from '@/lib/remarkFillInTheBlank.mjs'


export async function GET(req: NextRequest) {
  console.log("** crossword GET req=", req)

  try {
    let retMessage = "";
    let md2 = "";

    const { searchParams } = req.nextUrl
    const courseId = searchParams.get("courseId")
    const lang = searchParams.get("lang")
    const prefix = searchParams.get("prefix")
    const guide = searchParams.get("guide")
    const guideNumber = searchParams.get("guideNumber")
    const walletAddress = searchParams.get("walletAddress")
    const token = searchParams.get("token")

    const db = new Kysely<DB>({
      dialect: defineConfig.dialect
    })

    let billeteraUsuario = {}
    if (walletAddress && walletAddress != null) {
      billeteraUsuario = await db.selectFrom('billetera_usuario')
        .where('billetera', '=', walletAddress)
        .selectAll()
        .executeTakeFirst()
        if (billeteraUsuario.token != token) {
          retMessage += "\nToken stored for user doesn't match given token. "
        }
    }
    if (retMessage == "") {
      console.log("** cwd=", process.cwd())
      let fname = `../../resources/${lang}/${prefix}/${guide}.md`
      console.log("** fname=", fname)
      let md = await readFile(fname, 'utf8')
      console.log(md)

      let processor = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkDirective)
      .use(remarkFrontmatter)
      .use(remarkFillInTheBlank, { url: `${guide}/test` })
      .use(remarkStringify, { allowDangerousHtml: true })
      md2 = processor.processSync(md).toString()

    }

    return NextResponse.json(
      {
        markdown: md2,
        message: retMessage,
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
