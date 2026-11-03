import { sql } from 'kysely'
import { getClusterMembers } from './gd-utils.js'
import { getClusterApprovals, presentationDataHash, type ClusterApprovals } from './cluster-approvals.js'

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

// Estados de la presentación (https://github.com/pasosdeJesus/learn.tg/issues/161):
// el iniciador solicita (`requested`), pdJ revisa (`under_review`), devuelve con
// sugerencias (`returned`), aprueba (`approved`), envía a GD (`sent`) y registra la
// respuesta (`answered`). `cancelled` es la retirada del iniciador antes de la revisión.
export const GD_PRESENTATION_STATUSES = [
  'requested',
  'under_review',
  'returned',
  'approved',
  'sent',
  'answered',
  'cancelled',
] as const

export type GdPresentationStatus = (typeof GD_PRESENTATION_STATUSES)[number]

// Con estos estados los cinco campos quedan fijos (read-only). `returned` y
// `cancelled` los desbloquean para que el iniciador los corrija o los vuelva a llenar.
const LOCKING_STATUSES: GdPresentationStatus[] = [
  'requested',
  'under_review',
  'approved',
  'sent',
  'answered',
]

const TRANSITIONS: Record<GdPresentationStatus, GdPresentationStatus[]> = {
  requested: ['under_review', 'returned', 'cancelled'],
  under_review: ['returned', 'approved', 'sent'],
  returned: ['approved', 'under_review'],
  approved: ['sent'],
  sent: ['answered'],
  answered: [],
  cancelled: [],
}

export function presentationFieldsLocked(status: string | null | undefined): boolean {
  return !!status && (LOCKING_STATUSES as string[]).includes(status)
}

export function canTransitionPresentation(
  from: string | null | undefined,
  to: string,
): boolean {
  if (!from) return false
  return (TRANSITIONS[from as GdPresentationStatus] ?? []).includes(to as GdPresentationStatus)
}

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
  status: GdPresentationStatus | null
  locked: boolean
  requested_at: string | null
  requested_by: number | null
  reviewed_at: string | null
  returned_at: string | null
  approved_at: string | null
  sent_at: string | null
  sent_by: number | null
  answered_at: string | null
  evaluation: string | null
  suggestions: string | null
  response: string | null
  response_at: string | null
  response_by: number | null
  contact_email: string | null
  first_year_budget: number | null
  budget_draft_path: string | null
  budget_fixed_at: string | null
  director_offer_path: string | null
  director_first_year_pay: number | null
  director_first_year_hours: number | null
  director_fixed_at: string | null
}

export interface PresentationReadiness {
  ready: boolean
  cluster_status: string | null
  member_churches: number
  pastors: PastorCheck[]
  missing: string[]
  /** Campos del presupuesto/oferta que faltan para poder solicitar la presentación. */
  missing_data: string[]
  /** Billetera del clúster (la de la iglesia iniciadora). */
  wallet: string | null
  /** Aprobaciones de los pastores para el hash vigente de los datos. */
  approvals: ClusterApprovals
  request: PresentationRequest | null
}

/**
 * Los cinco datos que se fijan al solicitar la presentación. Se devuelven como claves
 * estables para que la UI y el error del POST usen el mismo vocabulario.
 */
export function missingPresentationData(cluster: {
  first_year_budget?: unknown
  budget_draft_path?: unknown
  director_offer_path?: unknown
  director_first_year_pay?: unknown
  director_first_year_hours?: unknown
}): string[] {
  const missing: string[] = []
  if (cluster.first_year_budget === null || cluster.first_year_budget === undefined || Number(cluster.first_year_budget) <= 0) {
    missing.push('budget_total')
  }
  if (!cluster.budget_draft_path) missing.push('budget_pdf')
  if (!cluster.director_offer_path) missing.push('director_offer_pdf')
  if (cluster.director_first_year_pay === null || cluster.director_first_year_pay === undefined || Number(cluster.director_first_year_pay) <= 0) {
    missing.push('director_pay')
  }
  if (cluster.director_first_year_hours === null || cluster.director_first_year_hours === undefined || Number(cluster.director_first_year_hours) <= 0) {
    missing.push('director_hours')
  }
  return missing
}

function num(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
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

  // La billetera del clúster (la de la iglesia iniciadora) es condición de la guía 6:
  // sin ella no se puede liberar el fondo, así que no se presenta el clúster.
  const initiatorChurch = cluster.initiator_church_id
    ? await db
        .selectFrom('church')
        .select('cluster_wallet')
        .where('id', '=', cluster.initiator_church_id)
        .executeTakeFirst()
    : null
  if (!initiatorChurch?.cluster_wallet) missing.push('cluster_wallet')

  // Los pastores aprueban los cinco datos + la billetera; sin todas las aprobaciones el
  // iniciador no puede pedir la revisión de pdJ.
  const wallet = initiatorChurch?.cluster_wallet ?? null
  const approvalHash = presentationDataHash(cluster, wallet)
  const approvals = await getClusterApprovals(db, clusterId, approvalHash)
  if (!approvals.all_approved) missing.push('approvals')

  const request: PresentationRequest = {
    status: (cluster.gd_status as GdPresentationStatus | null) ?? null,
    locked: presentationFieldsLocked(cluster.gd_status),
    requested_at: iso(cluster.gd_requested_at),
    requested_by: cluster.gd_requested_by ?? null,
    reviewed_at: iso(cluster.gd_reviewed_at),
    returned_at: iso(cluster.gd_returned_at),
    approved_at: iso(cluster.gd_approved_at),
    sent_at: iso(cluster.gd_sent_at),
    sent_by: cluster.gd_sent_by ?? null,
    answered_at: iso(cluster.gd_answered_at),
    evaluation: cluster.gd_evaluation ?? null,
    suggestions: cluster.gd_suggestions ?? null,
    response: cluster.gd_response ?? null,
    response_at: iso(cluster.gd_response_at),
    response_by: cluster.gd_response_by ?? null,
    contact_email: cluster.gd_contact_email ?? null,
    first_year_budget: num(cluster.first_year_budget),
    budget_draft_path: cluster.budget_draft_path ?? null,
    budget_fixed_at: iso(cluster.budget_fixed_at),
    director_offer_path: cluster.director_offer_path ?? null,
    director_first_year_pay: num(cluster.director_first_year_pay),
    director_first_year_hours: num(cluster.director_first_year_hours),
    director_fixed_at: iso(cluster.director_fixed_at),
  }

  return {
    ready: missing.length === 0 && pastors.every((pastor) => pastor.missing.length === 0),
    cluster_status: status,
    member_churches: members.length,
    pastors,
    missing,
    missing_data: missingPresentationData(cluster),
    wallet,
    approvals,
    request:
      request.requested_at ||
      request.status ||
      request.first_year_budget != null ||
      request.budget_draft_path ||
      request.director_offer_path ||
      request.director_first_year_pay != null ||
      request.director_first_year_hours != null
        ? request
        : null,
  }
}
