'use server'

import clg from 'crossword-layout-generator-with-isolated'
import { readFile } from 'fs/promises'
import { Insertable, Kysely, PostgresDialect, sql, Updateable } from 'kysely'
import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import remarkDirective from 'remark-directive'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import remarkStringify from 'remark-stringify'
import rehypeStringify from 'rehype-stringify'
import { unified } from 'unified'

import { newKyselyPostgresql } from '@/.config/kysely.config'
import { recordEvent } from '@/lib/metrics-server'
import { getGuideIdBySuffix, getCourseIdByPrefix } from '@/lib/guide-utils'
import type { DB, BilleteraUsuario, Usuario } from '@/db/db.d.ts'
import { remarkFillInTheBlank } from '@/lib/remarkFillInTheBlank.mjs'

export async function GET(req: NextRequest) {
  console.log('** guide GET req=', req)

  try {
    let retMessage = ''
    let md2 = ''

    const { searchParams } = req.nextUrl
    const courseId = searchParams.get('courseId')
    const lang = searchParams.get('lang')
    const prefix = searchParams.get('prefix')
    const guide = searchParams.get('guide')
    const guideNumber = searchParams.get('guideNumber')
    const walletAddress = searchParams.get('walletAddress')
    const token = searchParams.get('token')

    console.log('[guide API] Parameters:', {
      courseId,
      lang,
      prefix,
      guide,
      guideNumber,
      walletAddress: walletAddress ? `${walletAddress.substring(0, 10)}...` : 'null',
      tokenLength: token?.length || 0
    })

    // Resolve courseId if not provided
    let resolvedCourseId: number | null = null
    if (courseId) {
      resolvedCourseId = parseInt(courseId)
    } else if (prefix) {
      // Try to get courseId from prefix
      resolvedCourseId = await getCourseIdByPrefix(prefix)
      if (resolvedCourseId !== null) {
        console.log('[guide API] Resolved courseId from prefix:', { prefix, resolvedCourseId })
      } else {
        console.log('[guide API] Could not resolve courseId from prefix:', prefix)
      }
    }

    // Calculate actual guideId for metrics
    let actualGuideId = 0
    if (resolvedCourseId && guide) {
      try {
        const guideId = await getGuideIdBySuffix(resolvedCourseId, guide)
        if (guideId !== null) {
          actualGuideId = guideId
        }
      } catch (error) {
        console.error('Error calculating guideId for metrics:', error)
      }
    }

    // Validate required parameters
    if (!lang || !prefix || !guide) {
      return NextResponse.json(
        { error: 'Missing required parameters: lang, prefix, guide' },
        { status: 500 }
      )
    }

    const db = newKyselyPostgresql()

    let billeteraUsuario: any = null
    if (walletAddress && walletAddress != null) {
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
      // Record guide view event if user is authenticated
      if (billeteraUsuario?.usuario_id) {
        try {
          await recordEvent({
            event_type: 'guide_view',
            event_data: {
              guideId: actualGuideId,
              courseId: resolvedCourseId || 0,
              timestamp: new Date().toISOString(),
            },
            usuario_id: billeteraUsuario.usuario_id,
          })
        } catch (error) {
          console.error('Failed to record guide_view event:', error)
        }
      }
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
        .use(remarkFillInTheBlank, { url: `${guide}/test` })
        // @ts-ignore
        .use(remarkRehype, { allowDangerousHtml: true })
        .use(rehypeStringify, { allowDangerousHtml: true })
      md2 = processor.processSync(md).toString()
    }

    return NextResponse.json(
      {
        markdown: md2,
        message: retMessage,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Excepción error=', error)
    return NextResponse.json({ error: error }, { status: 500 })
  }
}
