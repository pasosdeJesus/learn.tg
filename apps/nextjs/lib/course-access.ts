import { Kysely } from 'kysely'
import type { DB } from '@/db/db.d.ts'

export interface AccessResult {
  access: boolean
  reason?: string
}

/**
 * Course-specific access validators.
 * Each validator receives the DB instance and the authenticated user ID.
 * Return { access: true } if allowed, or { access: false, reason } if denied.
 */
type AccessValidator = (db: Kysely<DB>, userId: number) => Promise<AccessResult>

const COURSE_ACCESS_RULES: Record<number, AccessValidator> = {
  /**
   * Global Disciples course (id=10):
   * Restricted to non-Zionist churches. The pastor must answer all three
   * theological questions: 1=No, 2=Yes, 3=No.
   */
  10: async (db, userId) => {
    const church = await db
      .selectFrom('church')
      .select([
        'id',
        'pastoral_position_israel_covenant',
        'pastoral_position_israel_remnant',
        'pastoral_position_israel_gaza',
      ])
      .where('pastor_id', '=', userId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()

    if (!church) {
      return {
        access: false,
        reason: 'This course requires a registered church. Please declare your church in your profile.',
      }
    }

    const unanswered = (
      church.pastoral_position_israel_covenant === null ||
      church.pastoral_position_israel_covenant === undefined ||
      church.pastoral_position_israel_remnant === null ||
      church.pastoral_position_israel_remnant === undefined ||
      church.pastoral_position_israel_gaza === null ||
      church.pastoral_position_israel_gaza === undefined
    )
    if (unanswered) {
      return {
        access: false,
        reason: 'Please complete the theological position questions in your church profile to access this course.',
      }
    }

    const isNonZionist = (
      church.pastoral_position_israel_covenant === 'no' &&
      church.pastoral_position_israel_remnant === 'yes' &&
      church.pastoral_position_israel_gaza === 'no'
    )
    if (!isNonZionist) {
      return {
        access: false,
        reason: 'This course is restricted to churches whose pastors hold a non-Zionist theological position.',
      }
    }

    return { access: true }
  },
}

/**
 * Check whether a user can access a specific course.
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

  // Course-specific rules (e.g. non-Zionist requirement for GD)
  const validator = COURSE_ACCESS_RULES[courseId]
  if (!validator) {
    return { access: true }
  }
  return validator(db, userId)
}
