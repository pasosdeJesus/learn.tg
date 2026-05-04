// Helper functions for guide-related operations
// "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)

// The 1-indexed guideId corresponds to position in the ordered list of guides
// (ordered by nombrecorto) for the course. The actividadpf_id is the actual DB id.
// prefijoRuta includes leading slash in the database.

import { Kysely, sql } from 'kysely'
import type { DB } from '@/db/db.d.ts'

export async function getGuidesByCourseId(
  courseId: number,
  db: Kysely<DB>,
): Promise<any[] | null> {
  try {
    const guides = await sql<any>`
      SELECT id, nombrecorto, "sufijoRuta", proyectofinanciero_id
      FROM cor1440_gen_actividadpf
      WHERE proyectofinanciero_id = ${courseId}
      AND "sufijoRuta" IS NOT NULL
      AND "sufijoRuta" <> ''
      ORDER BY nombrecorto
    `.execute(db)

    if (!guides.rows || guides.rows.length === 0) {
      return null
    }

    return guides.rows
  } catch (error) {
    console.error('Error getting guides by courseId:', error)
    return null
  }
}

export async function getGuideIdBySuffix(
  courseId: number,
  suffix: string,
  db: Kysely<DB>
): Promise<number | null> {

  try {
    // Validate courseId is a positive integer
    if (!Number.isFinite(courseId) || courseId <= 0) {
      return null
    }

    const guides = await getGuidesByCourseId(courseId, db)

    if (!guides || guides.length === 0) {
      return null
    }

    // Find the index of the guide with matching suffix
    const index = guides.findIndex((row: any) => row.sufijoRuta === suffix)

    if (index === -1) {
      return null
    }

    // Return 1-indexed guideId
    return index + 1
  } catch (error) {
    console.error('Error getting guideId by suffix:', error)
    return null
  }
}

export async function getActividadpfId(
  courseId: number,
  guideId: number,
  db: Kysely<DB>
): Promise<number | null> {
  try {
    const guides = await getGuidesByCourseId(courseId, db)

    if (!guides || guides.length === 0) {
      return null
    }

    if (guideId < 1 || guideId > guides.length) {
      return null
    }

    return guides[guideId - 1].id
  } catch (error) {
    console.error('Error getting actividadpf_id:', error)
    return null
  }
}

export async function getCourseIdByPrefix(
  prefix: string,
  db: Kysely<DB>
): Promise<number | null> {
  try {
    // Validate prefix is not empty
    if (!prefix || prefix.trim() === '') {
      return null
    }

    // prefijoRuta includes leading slash in database
    const prefijoRuta = `/${prefix}`

    const result = await sql<any>`
      SELECT id
      FROM cor1440_gen_proyectofinanciero
      WHERE "prefijoRuta" = ${prefijoRuta}
      LIMIT 1
    `.execute(db)

    if (!result.rows || result.rows.length === 0) {
      return null
    }

    return result.rows[0].id
  } catch (error) {
    console.error('Error getting courseId by prefix:', error)
    return null
  }
}
