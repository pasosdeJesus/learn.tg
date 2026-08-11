import { Kysely } from 'kysely'
import type { DB } from '@/db/db.d'
import { SCORE_RULES, ALL_SCORE_FIELDS } from '@/lib/score-rules'

/** Pilot phase: only these countries can create clusters and receive donations */
export const PILOT_COUNTRIES = [170, 694] // Colombia, Sierra Leona

export interface Church {
  id: number
  name: string
  country_id: number
  department_id: number | null
  municipality_id: number | null
  city_id: number | null
  city_name: string | null
  address: string | null
  pastor_name: string
  pastor_whatsapp: string
  pastor_telegram: string | null
  pastor_id: number | null
  cluster_wallet: string | null
  denomination: string | null
  registration: string | null
  registration_photo: string | null
  registration_verified: boolean
  created_by: number
  created_at: Date
  updated_at: Date
}

export interface ClusterGD {
  id: number
  name: string
  code: string
  country_id: number
  created_at: Date
  updated_at: Date
}

export interface ClusterMember {
  church_id: number
  church_name: string
  joined_at: Date
}

export interface ClusterHistory {
  event_type: string
  old_value: string | null
  new_value: string | null
  changed_by: number | null
  created_at: Date
}

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateClusterCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += CHARS.charAt(Math.floor(Math.random() * CHARS.length))
  }
  return code
}

export async function generateUniqueClusterCode(db: Kysely<DB>): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateClusterCode()
    const existing = await db
      .selectFrom('clustergd')
      .select('id')
      .where('code', '=', code)
      .executeTakeFirst()
    if (!existing) return code
  }
  throw new Error('Could not generate unique cluster code after 10 attempts')
}

export function generateClusterCodeSync(): string {
  return generateClusterCode()
}

export async function getPastorChurch(
  db: Kysely<DB>,
  userId: number
): Promise<Church | null> {
  const church = await db
    .selectFrom('church')
    .selectAll()
    .where('created_by', '=', userId)
    .executeTakeFirst()
  return church as Church | null
}

export async function getChurchCluster(
  db: Kysely<DB>,
  churchId: number
): Promise<{ clustergd_id: number; joined_at: Date | null; left_at: Date | null } | null> {
  const result = await db
    .selectFrom('church_clustergd')
    .select(['clustergd_id', 'joined_at', 'left_at'])
    .where('church_id', '=', churchId)
    .where('left_at', 'is', null)
    .executeTakeFirst()
  return result ?? null
}

export async function getClusterMembers(
  db: Kysely<DB>,
  clusterId: number
): Promise<ClusterMember[]> {
  const members = await db
    .selectFrom('church_clustergd as cc')
    .innerJoin('church as c', 'c.id', 'cc.church_id')
    .select(['cc.church_id', 'c.name as church_name', 'cc.joined_at'])
    .where('cc.clustergd_id', '=', clusterId)
    .where('cc.left_at', 'is', null)
    .orderBy('cc.joined_at', 'asc')
    .execute()
  return members as ClusterMember[]
}

export async function getClusterHistory(
  db: Kysely<DB>,
  clusterId: number
): Promise<ClusterHistory[]> {
  const history = await db
    .selectFrom('clustergd_history')
    .select(['event_type', 'old_value', 'new_value', 'changed_by', 'created_at'])
    .where('clustergd_id', '=', clusterId)
    .orderBy('created_at', 'desc')
    .execute()
  return history as ClusterHistory[]
}

export async function addClusterHistory(
  db: Kysely<DB>,
  clusterId: number,
  eventType: string,
  oldValue: string | null,
  newValue: string | null,
  changedBy: number | null
): Promise<void> {
  await db
    .insertInto('clustergd_history')
    .values({
      clustergd_id: clusterId,
      event_type: eventType,
      old_value: oldValue,
      new_value: newValue,
      changed_by: changedBy,
    })
    .execute()
}

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
