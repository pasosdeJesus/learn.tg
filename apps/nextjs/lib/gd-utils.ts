import { Kysely } from 'kysely'
import type { DB } from '@/db/db.d'
import { SCORE_RULES, ALL_SCORE_FIELDS } from '@/lib/score-rules'

// Las funciones de dominio GD (clusters, iglesias, códigos) viven ahora en el
// motor `@learn-tg/gdcluster` (REQ/35 Fase 3). Este archivo conserva solo el
// scoring de perfil, usado por rutas del core (profile, update-scores,
// verified-data, admin/user/[id]).

export async function updateProfileScore(
  db: Kysely<DB>,
  userId: number,
  points: number
): Promise<void> {
  await db
    .updateTable('usuario')
    .set((eb) => ({
      profilescore: eb('profilescore', '+', points),
      updated_at: new Date(),
    }))
    .where('id', '=', userId)
    .execute()
}

/**
 * Calculates profile score based on verified fields:
 * - Name verified (nombre = passport_name): 26 pts
 * - Country verified (pais_id = passport_nationality): 24 pts
 * - Email verified (email = verified_email): 9 pts
 * - WhatsApp or Telegram verified: 9 pts
 * - GoodDollar verified (lastgooddollarverification IS NOT NULL): 7 pts
 * - Location verified (city_id = verified_city_id, or for countries without cities: place_of_worship_location = verified_place_of_worship_location): 9 pts
 * - Place of worship verified: 9 pts
 * - Interview scheduled: 7 pts
 * Total: 100
 */
export async function recalculateProfileScore(
  db: Kysely<DB>,
  userId: number
): Promise<number> {
  const user = await db
    .selectFrom('usuario')
    .select(ALL_SCORE_FIELDS as any)
    .where('id', '=', userId)
    .executeTakeFirst()

  if (!user) return 0

  let score = 0
  for (const rule of SCORE_RULES) {
    if (rule.check(user as any)) {
      score += rule.points
    }
  }

  await db
    .updateTable('usuario')
    .set({ profilescore: score, updated_at: new Date() })
    .where('id', '=', userId)
    .execute()

  return score
}
