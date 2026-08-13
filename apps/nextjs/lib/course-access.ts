import { Kysely } from 'kysely'
import type { DB } from '@/db/db.d.ts'
import { PILOT_COUNTRIES } from '@/lib/gd-utils'

export interface AccessResult {
  access: boolean
  reason?: string
}

/**
 * Check whether a user can access a specific course's guides.
 *
 * Guides are gated by purchase only (`premium_course_usuario`). Course-specific
 * eligibility (e.g. GD pilot) gates the *purchase*, not guide viewing — see
 * `canPurchaseGDCourse`.
 *
 * @param db    Kysely DB instance
 * @param userId Authenticated user ID (usuario.id)
 * @param courseId Course ID (cor1440_gen_proyectofinanciero.id)
 * @returns AccessResult with `access: boolean` and optional `reason` string.
 */
export async function canAccessCourse(
  db: Kysely<DB>,
  userId: number,
  courseId: number,
): Promise<AccessResult> {
  // Premium check (applies to all courses)
  const course = await db
    .selectFrom('cor1440_gen_proyectofinanciero')
    .select('porPagar')
    .where('id', '=', courseId)
    .executeTakeFirst()

  const isPremium =
    course?.porPagar !== null &&
    course?.porPagar !== undefined &&
    Number(course.porPagar) > 0

  if (isPremium) {
    const enrollment = await db
      .selectFrom('premium_course_usuario')
      .select('id')
      .where('usuario_id', '=', userId)
      .where('course_id', '=', courseId)
      .executeTakeFirst()

    if (!enrollment) {
      return {
        access: false,
        reason: 'This is a premium course. Purchase it to access its guides.',
      }
    }
  }

  return { access: true }
}

/**
 * Global Disciples course purchase eligibility (pilot phase).
 *
 * A user can buy the GD course only if they are:
 *   - a Christian (`usuario.religion_id = 2`), and
 *   - in a pilot country (`usuario.pais_id` in Colombia or Sierra Leone), and
 *   - a member of a church (`usuario.church_id`) whose pastor is registered
 *     (`church.pastor_id` set) and declared non-Zionist
 *     (`pastoral_position_israel_covenant='no'`,
 *      `pastoral_position_israel_remnant='yes'`,
 *      `pastoral_position_israel_gaza='no'`).
 */
export async function canPurchaseGDCourse(
  db: Kysely<DB>,
  userId: number,
): Promise<AccessResult> {
  const user = await db
    .selectFrom('usuario')
    .select(['religion_id', 'pais_id', 'church_id'])
    .where('id', '=', userId)
    .executeTakeFirst()

  if (!user || user.religion_id !== 2) {
    return { access: false, reason: 'This course is for Christians.' }
  }

  if (!user.pais_id || !PILOT_COUNTRIES.includes(user.pais_id)) {
    return {
      access: false,
      reason: 'This course is only available in pilot countries (Colombia, Sierra Leone).',
    }
  }

  if (!user.church_id) {
    return {
      access: false,
      reason: 'This course requires belonging to a church.',
    }
  }

  const church = await db
    .selectFrom('church')
    .select([
      'id',
      'pastor_id',
      'pastoral_position_israel_covenant',
      'pastoral_position_israel_remnant',
      'pastoral_position_israel_gaza',
    ])
    .where('id', '=', user.church_id)
    .where('deleted_at', 'is', null)
    .executeTakeFirst()

  if (!church) {
    return {
      access: false,
      reason: 'This course requires belonging to a church.',
    }
  }

  if (church.pastor_id === null || church.pastor_id === undefined) {
    return {
      access: false,
      reason: 'This course requires a church whose pastor is registered.',
    }
  }

  const isNonZionist =
    church.pastoral_position_israel_covenant === 'no' &&
    church.pastoral_position_israel_remnant === 'yes' &&
    church.pastoral_position_israel_gaza === 'no'

  if (!isNonZionist) {
    return {
      access: false,
      reason: 'This course is restricted to churches whose pastor is non-Zionist.',
    }
  }

  return { access: true }
}
