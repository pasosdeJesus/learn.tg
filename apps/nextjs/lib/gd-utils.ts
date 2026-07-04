import { Kysely } from 'kysely'
import type { DB } from '@/db/db.d'
import { newKyselyPostgresql } from '@/.config/kysely-db'

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
  government_registration: string | null
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
 * Calculates profile score based on verified fields (REQ §5):
 * - Name + country: 68 pts (basic — country_id IS NOT NULL)
 * - WhatsApp or Telegram verified: 12 pts
 * - Location verified: 10 pts (dept + municipality + city match)
 * - Place of worship verified: 10 pts
 * Total: 100
 */
export async function recalculateProfileScore(
  db: Kysely<DB>,
  userId: number
): Promise<number> {
  const user = await db
    .selectFrom('usuario')
    .select([
      'country_id',
      'whatsapp',
      'telegram',
      'verified_whatsapp',
      'verified_telegram',
      'department_id',
      'municipality_id',
      'city_id',
      'verified_department_id',
      'verified_municipality_id',
      'verified_city_id',
      'place_of_worship',
      'verified_place_of_worship',
    ])
    .where('id', '=', userId)
    .executeTakeFirst()

  if (!user) return 0

  let score = 0

  // Name + country: 68 pts
  if (user.country_id != null) score += 68

  // WhatsApp or Telegram verified: 12 pts (max 12, not 24)
  if ((user.whatsapp && user.verified_whatsapp && user.whatsapp === user.verified_whatsapp) ||
      (user.telegram && user.verified_telegram && user.telegram === user.verified_telegram)) {
    score += 12
  }

  // Location verified: 10 pts
  if (user.department_id != null &&
      user.verified_department_id === user.department_id &&
      user.verified_municipality_id === user.municipality_id &&
      user.verified_city_id === user.city_id) {
    score += 10
  }

  // Place of worship verified: 10 pts
  if (user.place_of_worship && user.verified_place_of_worship &&
      user.place_of_worship === user.verified_place_of_worship) {
    score += 10
  }

  await db
    .updateTable('usuario')
    .set({ profilescore: score, updated_at: new Date() })
    .where('id', '=', userId)
    .execute()

  return score
}
