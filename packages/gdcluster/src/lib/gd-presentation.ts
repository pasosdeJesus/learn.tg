import { sql } from 'kysely'
import { getClusterMembers } from './gd-utils.js'

// Condiciones para que el iniciador pida presentar el clúster a Global Disciples
// (R-#161, decisión del operador 2026-10-27):
//   - clúster activo con 3 o más iglesias;
//   - cada pastor principal de esas iglesias terminó el curso GD (las 6 guías);
//   - cada pastor tiene perfil **mayor a 90** (el umbral con que se activa el
//     programa de referidos);
//   - cada pastor invitó al menos a un pastor/co-pastor y a un miembro o líder
//     **de su propia iglesia** (`referralrelationship`).
// Los umbrales viven aquí para que la regla tenga un solo lugar.

export const GD_COURSE_IDS = [10, 11]
export const MIN_PROFILE_SCORE = 90 // estrictamente mayor: > 90

export interface PastorCheck {
  usuario_id: number
  nombre: string | null
  church_id: number
  church_name: string
  guides_done: number
  guides_total: number
  course_completed: boolean
  profile_score: number
  invited_pastor: boolean
  invited_member: boolean
  missing: string[]
}

export interface PresentationRequest {
  requested_at: string | null
  requested_by: number | null
  sent_at: string | null
  sent_by: number | null
  response: string | null
  response_at: string | null
  response_by: number | null
  contact_email: string | null
}

export interface PresentationReadiness {
  ready: boolean
  cluster_status: string | null
  member_churches: number
  pastors: PastorCheck[]
  missing: string[]
  request: PresentationRequest | null
}

function iso(value: unknown): string | null {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : String(value)
}

export async function getPresentationReadiness(db: any, clusterId: number): Promise<PresentationReadiness> {
  const cluster = await db
    .selectFrom('clustergd')
    .selectAll()
    .where('id', '=', clusterId)
    .executeTakeFirst()

  if (!cluster) throw new Error('Cluster not found')

  const members = await getClusterMembers(db, clusterId)

  const totals = await sql<{ course_id: number; total: number }>`
    SELECT "proyectofinanciero_id" AS course_id, COUNT(*)::int AS total
      FROM cor1440_gen_actividadpf
     WHERE "proyectofinanciero_id" IN (${sql.join(GD_COURSE_IDS.map((id) => sql`${id}`), sql`, `)})
       AND "sufijoRuta" IS NOT NULL AND "sufijoRuta" <> ''
     GROUP BY "proyectofinanciero_id"
  `.execute(db)
  const totalByCourse = new Map<number, number>(
    totals.rows.map((row) => [Number(row.course_id), Number(row.total)]),
  )

  const pastors: PastorCheck[] = []
  for (const member of members) {
    const churchId = Number(member.church_id)
    const churchName = member.church_name

    const pastor = await db
      .selectFrom('usuario as u')
      .select(['u.id', 'u.nombre', 'u.profilescore'])
      .where('u.church_id', '=', churchId)
      .where('u.church_relationship', '=', 'pastor')
      .executeTakeFirst()

    if (!pastor) {
      pastors.push({
        usuario_id: 0, nombre: null, church_id: churchId, church_name: churchName,
        guides_done: 0, guides_total: 0, course_completed: false, profile_score: 0,
        invited_pastor: false, invited_member: false, missing: ['no_pastor'],
      })
      continue
    }

    const done = await sql<{ course_id: number; done: number }>`
      SELECT a."proyectofinanciero_id" AS course_id, COUNT(DISTINCT gu."actividadpf_id")::int AS done
        FROM guide_usuario gu
        JOIN cor1440_gen_actividadpf a ON a.id = gu."actividadpf_id"
       WHERE gu.usuario_id = ${pastor.id}
         AND gu.points > 0
         AND a."proyectofinanciero_id" IN (${sql.join(GD_COURSE_IDS.map((id) => sql`${id}`), sql`, `)})
       GROUP BY a."proyectofinanciero_id"
    `.execute(db)

    let guidesDone = 0
    let guidesTotal = 0
    let courseCompleted = false
    for (const row of done.rows) {
      const courseId = Number(row.course_id)
      const total = totalByCourse.get(courseId) ?? 0
      const completed = Number(row.done)
      if (total > 0 && completed >= total) courseCompleted = true
      if (completed > guidesDone) {
        guidesDone = completed
        guidesTotal = total
      }
    }
    if (!guidesTotal) {
      // Sin avance: se informa el total del curso en inglés para que la UI muestre 0/N.
      guidesTotal = totalByCourse.get(GD_COURSE_IDS[0]) ?? 0
    }

    const referrals = await sql<{ church_relationship: string | null; church_id: number | null }>`
      SELECT u."church_relationship" AS church_relationship, u.church_id AS church_id
        FROM referralrelationship rr
        JOIN usuario u ON u.id = rr.referred_id
       WHERE rr.referrer_id = ${pastor.id}
    `.execute(db)

    const invitedPastor = referrals.rows.some(
      (row) => row.church_relationship === 'pastor' || row.church_relationship === 'co_pastor',
    )
    const invitedMember = referrals.rows.some(
      (row) =>
        (row.church_relationship === 'member' || row.church_relationship === 'leader') &&
        Number(row.church_id) === churchId,
    )

    const profileScore = Number(pastor.profilescore ?? 0)
    const missing: string[] = []
    if (!courseCompleted) missing.push('course')
    if (!(profileScore > MIN_PROFILE_SCORE)) missing.push('score')
    if (!invitedPastor) missing.push('invite_pastor')
    if (!invitedMember) missing.push('invite_member')

    pastors.push({
      usuario_id: Number(pastor.id),
      nombre: pastor.nombre ?? null,
      church_id: churchId,
      church_name: churchName,
      guides_done: guidesDone,
      guides_total: guidesTotal,
      course_completed: courseCompleted,
      profile_score: profileScore,
      invited_pastor: invitedPastor,
      invited_member: invitedMember,
      missing,
    })
  }

  const missing: string[] = []
  const status = cluster.status ?? null
  if (status !== 'active') missing.push('cluster_active')
  if (members.length < 3) missing.push('cluster_members')
  if (pastors.length === 0) missing.push('no_pastors')

  const request: PresentationRequest = {
    requested_at: iso(cluster.gd_requested_at),
    requested_by: cluster.gd_requested_by ?? null,
    sent_at: iso(cluster.gd_sent_at),
    sent_by: cluster.gd_sent_by ?? null,
    response: cluster.gd_response ?? null,
    response_at: iso(cluster.gd_response_at),
    response_by: cluster.gd_response_by ?? null,
    contact_email: cluster.gd_contact_email ?? null,
  }

  return {
    ready: missing.length === 0 && pastors.every((pastor) => pastor.missing.length === 0),
    cluster_status: status,
    member_churches: members.length,
    pastors,
    missing,
    request: request.requested_at ? request : null,
  }
}
