import { createHash } from 'node:crypto'
import type { Kysely } from 'kysely'
import { getClusterPastors } from './cluster-pastors.js'

// Aprobación de los pastores para presentar el clúster a Global Disciples
// (https://github.com/pasosdeJesus/learn.tg/issues/161, REQ/161 §4.7). Hay **dos
// fases independientes** y cada una guarda su propio SHA-256:
//
// - `wallet`: la billetera del clúster. Al aprobarla los tres pastores el estado pasa
//   a `wallet_approved` y el fondo del clúster empieza a existir. Cambiar la billetera
//   antes de eso caduca estas aprobaciones; después ya no se puede cambiar.
// - `data`: los cinco datos que se envían a GD (presupuesto del cuarto año, PDF del
//   presupuesto, PDF de la oferta del director, pago y horas del primer año). La
//   tercera aprobación es la solicitud a pdJ.
//
// El hash se recalcula al leer, así que un cambio caduca las aprobaciones solo.

export type ApprovalPhase = 'wallet' | 'data'

export interface PresentationData {
  fourth_year_budget?: unknown
  budget_draft_path?: unknown
  director_offer_path?: unknown
  director_first_year_pay?: unknown
  director_first_year_hours?: unknown
}

export interface ClusterApprovals {
  pastors: number
  approved: number
  all_approved: boolean
  voters: number[]
  hash: string
  phase: ApprovalPhase
}

export interface ClusterApprovalSummary {
  wallet: ClusterApprovals
  data: ClusterApprovals
}

function part(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

/** Hash de los cinco datos (sin la billetera: tiene su propia fase). */
export function presentationDataHash(data: PresentationData): string {
  const parts = [
    data.fourth_year_budget,
    data.budget_draft_path,
    data.director_offer_path,
    data.director_first_year_pay,
    data.director_first_year_hours,
  ].map(part)
  return createHash('sha256').update(parts.join('|')).digest('hex')
}

/** Hash de la billetera tal como está escrita (un cambio de checksum es un cambio). */
export function walletHash(wallet: string | null | undefined): string {
  return createHash('sha256').update(part(wallet)).digest('hex')
}

export async function getClusterApprovals(
  db: Kysely<any>,
  clusterId: number,
  hash: string,
  phase: ApprovalPhase,
): Promise<ClusterApprovals> {
  const pastors = await getClusterPastors(db, clusterId)
  const ids = pastors.map((pastor) => pastor.usuario_id)
  const empty: ClusterApprovals = {
    pastors: ids.length,
    approved: 0,
    all_approved: false,
    voters: [],
    hash,
    phase,
  }
  if (ids.length === 0) return empty

  const rows = await db
    .selectFrom('cluster_gd_approval')
    .select('usuario_id')
    .where('clustergd_id', '=', clusterId)
    .where('phase', '=', phase)
    .where('data_hash', '=', hash)
    .where('usuario_id', 'in', ids)
    .execute()

  const voters = rows.map((row: any) => Number(row.usuario_id))
  return {
    pastors: ids.length,
    approved: voters.length,
    all_approved: voters.length >= ids.length,
    voters,
    hash,
    phase,
  }
}

/** Las dos fases de una vez, que es lo que necesitan la página y la ruta. */
export async function getClusterApprovalSummary(
  db: Kysely<any>,
  clusterId: number,
  cluster: PresentationData,
  wallet: string | null,
): Promise<ClusterApprovalSummary> {
  return {
    wallet: await getClusterApprovals(db, clusterId, walletHash(wallet), 'wallet'),
    data: await getClusterApprovals(db, clusterId, presentationDataHash(cluster), 'data'),
  }
}
