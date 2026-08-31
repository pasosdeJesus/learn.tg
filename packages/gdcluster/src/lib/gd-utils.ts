import { Kysely, sql } from 'kysely'

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

export async function generateUniqueClusterCode(db: Kysely<any>): Promise<string> {
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
  db: Kysely<any>,
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
  db: Kysely<any>,
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
  db: Kysely<any>,
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
  db: Kysely<any>,
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
  db: Kysely<any>,
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

// ── REQ/220: invitaciones y notificaciones ────────────────────────────────

export interface ClusterCandidate {
  usuario_id: number
  nombre: string | null
  nusuario: string
  church_id: number
  church_name: string
  country_id: number
}

/**
 * Notificación in-app (tabla `notifications`, R-#162 MVP).
 */
export async function notifyUser(
  db: Kysely<any>,
  usuarioId: number,
  type: string,
  title: string,
  content: string,
  link = ''
): Promise<void> {
  await db
    .insertInto('notifications')
    .values({ usuario_id: usuarioId, type, title, content, link, is_read: false, created_at: new Date() })
    .execute()
}

/**
 * Candidatos a invitar a un clúster (REQ/220 §2.1):
 * 1. Pastores referidos por el líder (grafo #163) con iglesia declarada y
 *    verificada, mismo país, sin clúster actual.
 * 2. El referidor del líder, si es pastor (mismas condiciones).
 * Excluye al propio líder y a pastores ya en un clúster.
 */
export async function getClusterCandidates(
  db: Kysely<any>,
  leaderUserId: number,
  leaderCountryId: number,
  leaderChurchId: number
): Promise<ClusterCandidate[]> {
  const base = (refQuery: any) =>
    refQuery
      .innerJoin('church as c', 'c.created_by', 'u.id')
      .leftJoin('church_clustergd as cc', (jb: any) => jb.on('cc.church_id', '=', sql.ref('c.id')).on('cc.left_at', 'is', null))
      .select([
        'u.id as usuario_id', 'u.nombre', 'u.nusuario',
        'c.id as church_id', 'c.name as church_name', 'c.country_id',
      ])
      .where('u.church_relationship', '=', 'pastor')
      .where('u.fechadeshabilitacion', 'is', null)
      .where('c.registration_verified', '=', true)
      .where('c.country_id', '=', leaderCountryId)
      .where('c.id', '!=', leaderChurchId)
      .where('cc.church_id', 'is', null) // sin clúster actual
      .execute()

  const referred = await base(
    db.selectFrom('referralrelationship as rr').innerJoin('usuario as u', 'u.id', 'rr.referred_id').where('rr.referrer_id', '=', leaderUserId)
  )
  const referrer = await base(
    db.selectFrom('referralrelationship as rr').innerJoin('usuario as u', 'u.id', 'rr.referrer_id').where('rr.referred_id', '=', leaderUserId)
  )

  const seen = new Set<number>()
  const candidates: ClusterCandidate[] = []
  for (const row of [...referred, ...referrer]) {
    if (seen.has(row.usuario_id)) continue
    seen.add(row.usuario_id)
    candidates.push({
      usuario_id: row.usuario_id,
      nombre: row.nombre ?? null,
      nusuario: row.nusuario,
      church_id: row.church_id,
      church_name: row.church_name,
      country_id: row.country_id,
    })
  }
  return candidates
}
