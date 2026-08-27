import { Kysely } from 'kysely'
import type { DB } from '@/db/db.d.ts'
// Puente de migración (REQ/35 Fase 3): PILOT_COUNTRIES e isGDCourse viven en el
// motor gdcluster; el core aún los importa hasta resolver en Fase 4.
import { PILOT_COUNTRIES } from '@learn-tg/gdcluster/lib/gd-utils'
import { isGDCourse } from '@learn-tg/gdcluster/lib/gd-cluster-routing'

export interface AccessResult {
  access: boolean
  reason?: string
}

/**
 * True when the verifier has confirmed the user's place-of-worship city:
 * `verified_city_id` when the city is in a centro poblado, or the free-text
 * `verified_place_of_worship_location` otherwise (e.g. Freetown, which has no
 * centro poblado in the catalog).
 */
export function hasVerifiedWorshipCity(user: {
  verified_city_id?: number | null
  verified_place_of_worship_location?: string | null
}): boolean {
  return !!(user.verified_city_id || user.verified_place_of_worship_location)
}

/**
 * Check whether a user can access a specific course's guides.
 *
 * Guides are gated by purchase only (`premium_course_usuario`). Course-specific
 * eligibility (e.g. GD pilot) gates the *purchase*, not guide viewing — see
 * `canPurchasePremiumCourse`.
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
        reason: 'premium_purchase_required',
      }
    }
  }

  return { access: true }
}

/**
 * Purchase eligibility for ANY premium (paid) course.
 *
 * Paid courses have country-dependent prices, and the country itself is
 * self-reported — there is no country verification. The verifier-confirmed
 * church city (`verified_city_id` or `verified_place_of_worship_location`)
 * stands in for it, so every paid course purchase requires a verified worship
 * city. Global Disciples courses add the pilot gates on top
 * (`canPurchaseGDCourse`).
 */
export async function canPurchasePremiumCourse(
  db: Kysely<DB>,
  userId: number,
  courseId: number,
): Promise<AccessResult> {
  const user = await db
    .selectFrom('usuario')
    .select(['religion_id', 'pais_id', 'verified_city_id', 'verified_place_of_worship_location', 'position_israel_gaza'])
    .where('id', '=', userId)
    .executeTakeFirst()

  if (!user) {
    return { access: false, reason: 'auth_required' }
  }

  if (!hasVerifiedWorshipCity(user)) {
    return {
      access: false,
      reason: 'verified_city_required',
    }
  }

  if (isGDCourse(courseId)) {
    return canPurchaseGDCourse(db, userId)
  }

  return { access: true }
}

/**
 * Global Disciples course purchase eligibility (pilot phase).
 *
 * A user can buy the GD course only if they are:
 *   - a Christian (`usuario.religion_id = 2`), and
 *   - in a pilot country (`usuario.pais_id` in Colombia or Sierra Leone), and
 *   - verified in a church city (see `hasVerifiedWorshipCity`), and
 *   - non-Zionist: answered `no` to the single Gaza question in their own
 *     profile (`usuario.position_israel_gaza='no'`, i.e. does NOT support
 *     Israel in the Gaza genocide).
 */
export async function canPurchaseGDCourse(
  db: Kysely<DB>,
  userId: number,
): Promise<AccessResult> {
  const user = await db
    .selectFrom('usuario')
    .select(['religion_id', 'pais_id', 'verified_city_id', 'verified_place_of_worship_location', 'position_israel_gaza'])
    .where('id', '=', userId)
    .executeTakeFirst()

  if (!user || user.religion_id !== 2) {
    return { access: false, reason: 'gd_for_christians' }
  }

  if (!user.pais_id || !PILOT_COUNTRIES.includes(user.pais_id)) {
    return {
      access: false,
      reason: 'gd_pilot_countries',
    }
  }

  if (!hasVerifiedWorshipCity(user)) {
    return {
      access: false,
      reason: 'verified_city_required',
    }
  }

  if (user.position_israel_gaza !== 'no') {
    return {
      access: false,
      reason: 'gd_non_zionist',
    }
  }

  return { access: true }
}
