/**
 * Helper functions for guide-related operations
 *
 * "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)
 */

import { Kysely, sql } from 'kysely'
import { newKyselyPostgresql } from '@/.config/kysely.config'
import type { DB } from '@/db/db.d.ts'

/**
 * Get all guides for a given course, including their answers.
 *
 * @param courseId - Course ID (proyectofinanciero_id)
 * @param db - Kysely DB instance
 * @returns An array of guide objects, or null if not found
 */
export async function getGuidesByCourseId(
  courseId: number,
  db: Kysely<DB>,
): Promise<any[] | null> {
  try {
    const guides = await sql<any>`
      SELECT id, nombrecorto, "sufijoRuta", proyectofinanciero_id, answer_fib
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

/**
 * Get the 1-indexed guideId for a given course and guide suffix
 * The guideId corresponds to the position in the ordered list of guides
 * (ordered by nombrecorto) for the course.
 *
 * @param courseId - Course ID (proyectofinanciero_id)
 * @param suffix - Guide suffix (sufijoRuta)
 * @returns The 1-indexed guideId, or null if not found
 */
export async function getGuideIdBySuffix(
  courseId: number,
  suffix: string
): Promise<number | null> {
  const db = newKyselyPostgresql()

  try {
    console.log('[getGuideIdBySuffix] Input:', { courseId, suffix })

    // Validate courseId is a positive integer
    if (!Number.isFinite(courseId) || courseId <= 0) {
      console.log('[getGuideIdBySuffix] Invalid courseId:', courseId)
      return null
    }

    const guides = await getGuidesByCourseId(courseId, db)

    console.log('[getGuideIdBySuffix] Found guides:', guides?.length || 0)

    if (!guides || guides.length === 0) {
      console.log('[getGuideIdBySuffix] No guides found for courseId:', courseId)
      return null
    }

    // Debug: log all suffixes
    console.log('[getGuideIdBySuffix] Available suffixes:', guides.map((r: any) => r.sufijoRuta))

    // Find the index of the guide with matching suffix
    const index = guides.findIndex((row: any) => row.sufijoRuta === suffix)

    console.log('[getGuideIdBySuffix] Match index:', index, 'for suffix:', suffix)

    if (index === -1) {
      console.log('[getGuideIdBySuffix] No matching suffix found')
      return null
    }

    // Return 1-indexed guideId
    const guideId = index + 1
    console.log('[getGuideIdBySuffix] Returning guideId:', guideId)
    return guideId
  } catch (error) {
    console.error('Error getting guideId by suffix:', error)
    return null
  }
}

/**
 * Get the actividadpf_id for a given guideId and course
 *
 * @param courseId - Course ID (proyectofinanciero_id)
 * @param guideId - 1-indexed guideId
 * @returns The actividadpf_id, or null if not found
 */
export async function getActividadpfId(
  courseId: number,
  guideId: number
): Promise<number | null> {
  const db = newKyselyPostgresql()

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

/**
 * Get course ID by prefix (pathPrefix without leading slash)
 * Maps e.g. 'a-relationship-with-Jesus' to course ID 2
 *
 * @param prefix - Course path prefix (without leading slash)
 * @returns Course ID (proyectofinanciero_id), or null if not found
 */
export async function getCourseIdByPrefix(
  prefix: string
): Promise<number | null> {
  const db = newKyselyPostgresql()

  try {
    console.log('[getCourseIdByPrefix] Input:', { prefix })

    // Validate prefix is not empty
    if (!prefix || prefix.trim() === '') {
      console.log('[getCourseIdByPrefix] Invalid prefix:', prefix)
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
      console.log('[getCourseIdByPrefix] No course found for prefix:', prefix)
      return null
    }

    const courseId = result.rows[0].id
    console.log('[getCourseIdByPrefix] Found courseId:', courseId, 'for prefix:', prefix)
    return courseId
  } catch (error) {
    console.error('Error getting courseId by prefix:', error)
    return null
  }
}
