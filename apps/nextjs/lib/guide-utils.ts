/**
 * Helper functions for guide-related operations
 *
 * "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)
 */

import { sql } from 'kysely'
import { newKyselyPostgresql } from '@/.config/kysely.config'
import type { DB } from '@/db/db.d.ts'

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

    // Find the index of the guide with matching suffix
    const index = guides.rows.findIndex((row: any) => row.sufijoRuta === suffix)

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

    if (guideId < 1 || guideId > guides.rows.length) {
      return null
    }

    return guides.rows[guideId - 1].id
  } catch (error) {
    console.error('Error getting actividadpf_id:', error)
    return null
  }
}