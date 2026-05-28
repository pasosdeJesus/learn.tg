#!/usr/bin/env node
/**
 * Backfill course completion SBTs for students who completed courses
 * before the credential system existed.
 *
 * Usage:
 *   npx tsx scripts/backfill-credentials.ts
 *
 * Idempotent — skips users who already have a credential_emission record.
 * Uses mintCourseCredential() from lib/credentials.ts which handles
 * off-chain cache checks, on-chain duplicate detection, Celo L2 retry,
 * and transaction confirmation.
 */

import { newKyselyPostgresql } from '../.config/kysely.config'
import { mintCourseCredential } from '../lib/credentials'
import { sql } from 'kysely'

async function main() {
  const db = newKyselyPostgresql()

  console.log('🔍 Finding students who completed 100% of a course...')

  // Find all courses with published guides
  const courses = await sql<any>`
    SELECT DISTINCT proyectofinanciero_id AS course_id
    FROM cor1440_gen_actividadpf
    WHERE "sufijoRuta" IS NOT NULL
    AND "sufijoRuta" <> ''
  `.execute(db)

  console.log(`📚 Found ${courses.rows.length} courses with published guides`)

  let totalMinted = 0
  let totalSkipped = 0
  let totalErrors = 0

  for (const course of courses.rows) {
    const courseId = course.course_id

    // Get total published guides for this course
    const totalGuides = await sql<any>`
      SELECT COUNT(*)::int AS count
      FROM cor1440_gen_actividadpf
      WHERE proyectofinanciero_id = ${courseId}
      AND "sufijoRuta" IS NOT NULL
      AND "sufijoRuta" <> ''
    `.execute(db)
    const totalCount = totalGuides.rows[0].count

    // Get users who completed all guides but have no credential
    const candidates = await sql<any>`
      SELECT
        gu.usuario_id,
        COUNT(*)::int AS completed,
        bu.billetera AS wallet
      FROM guide_usuario gu
      JOIN billetera_usuario bu ON bu.usuario_id = gu.usuario_id
      WHERE gu.actividadpf_id IN (
        SELECT id FROM cor1440_gen_actividadpf
        WHERE proyectofinanciero_id = ${courseId}
        AND "sufijoRuta" IS NOT NULL
        AND "sufijoRuta" <> ''
      )
      AND gu.points = 1
      GROUP BY gu.usuario_id, bu.billetera
      HAVING COUNT(*)::int >= ${totalCount}
    `.execute(db)

    if (candidates.rows.length === 0) {
      console.log(`  Course ${courseId}: no candidates`)
      continue
    }

    console.log(`\n📖 Course ${courseId}: ${totalCount} guides, ${candidates.rows.length} eligible students`)

    for (const c of candidates.rows) {
      // Skip if already emitted
      const existing = await db
        .selectFrom('credential_emission')
        .select('id')
        .where('usuario_id', '=', c.usuario_id)
        .where('course_id', '=', courseId)
        .executeTakeFirst()

      if (existing) {
        totalSkipped++
        continue
      }

      try {
        console.log(`  🎓 Minting for user ${c.usuario_id} (${c.wallet})...`)
        const result = await mintCourseCredential(
          c.usuario_id,
          courseId,
          c.wallet,
        )
        if (result) {
          console.log(`    ✅ Minted! tokenId=${result.tokenId} tx=${result.txHash.slice(0, 14)}...`)
          totalMinted++
        } else {
          console.log(`    ⏭️  Already minted (on-chain or cache)`)
          totalSkipped++
        }
      } catch (err: any) {
        console.error(`    ❌ Error for user ${c.usuario_id}: ${err.message || err}`)
        totalErrors++
      }
    }
  }

  console.log(`\n📊 Summary:`)
  console.log(`   Minted:  ${totalMinted}`)
  console.log(`   Skipped: ${totalSkipped}`)
  console.log(`   Errors:  ${totalErrors}`)
}

main()
  .then(() => { console.log('\n✓ Backfill complete'); process.exit(0) })
  .catch(err => { console.error('\n✗ Fatal error:', err); process.exit(1) })
