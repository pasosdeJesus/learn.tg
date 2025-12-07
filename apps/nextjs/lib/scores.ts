
import { Kysely, sql, type Selectable } from 'kysely'
import type { DB, Usuario } from '@/db/db.d'

/**
 * Calculates the learning score for a given user.
 * @param db - The Kysely database instance.
 * @param userId - The ID of the user.
 * @returns The calculated learning score.
 */
export async function calculateLearningScore(
  db: Kysely<DB>,
  userId: number,
): Promise<number> {
  const guidePointsQuery = await db
    .selectFrom('guide_usuario')
    .where('usuario_id', '=', userId)
    .select(sql<number>`sum(points)`.as('total_points'))
    .executeTakeFirst()

  const coursePointsQuery = await db
    .selectFrom('course_usuario')
    .where('usuario_id', '=', userId)
    .select(sql<number>`sum(points)`.as('total_points'))
    .executeTakeFirst()

  const guidePoints = Number(guidePointsQuery?.total_points) || 0
  const coursePoints = Number(coursePointsQuery?.total_points) || 0

  return guidePoints + coursePoints
}

/**
 * Calculates the profile score for a given user.
 * @param user - The user object.
 * @param whitelisted - A boolean indicating if the user is whitelisted.
 * @returns The calculated profile score.
 */
export function calculateProfileScore(
  user: Selectable<Usuario>,
  whitelisted: boolean,
): number {
  let profilescore = 0
  if (whitelisted || user.passport_name) {
    profilescore += 52
  }
  if (user.passport_name) {
    profilescore += 24
  }
  if (user.passport_nationality) {
    profilescore += 24
  }
  /*if (user.email) {
    profilescore += 8
  }
  if (user.religion_id) {
    profilescore += 8
  } */

  return profilescore
}
