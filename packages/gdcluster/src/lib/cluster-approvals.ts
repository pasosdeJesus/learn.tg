import { createHash } from 'node:crypto'
import type { Kysely } from 'kysely'
import { getClusterPastors } from './cluster-pastors.js'

// Aprobación de los pastores para presentar el clúster a Global Disciples
// (https://github.com/pasosdeJesus/learn.tg/issues/161). Cada aprobación cubre los cinco
// datos que se envían a GD y la billetera del clúster; el hash se recalcula al leer, así
// que si pdJ devuelve la solicitud y cambia algo, las aprobaciones dejan de valer solas.

export interface PresentationData {
  first_year_budget?: unknown
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
}

export function presentationDataHash(data: PresentationData, wallet: string | null): string {
  const parts = [
    data.first_year_budget,
    data.budget_draft_path,
    data.director_offer_path,
    data.director_first_year_pay,
    data.director_first_year_hours,
    wallet,
  ].map((value) => (value === null || value === undefined ? '' : String(value).trim()))
  return createHash('sha256').update(parts.join('|')).digest('hex')
}

export async function getClusterApprovals(
  db: Kysely<any>,
  clusterId: number,
  hash: string,
): Promise<ClusterApprovals> {
  const pastors = await getClusterPastors(db, clusterId)
  const ids = pastors.map((pastor) => pastor.usuario_id)
  const empty: ClusterApprovals = { pastors: ids.length, approved: 0, all_approved: false, voters: [], hash }
  if (ids.length === 0) return empty

  const rows = await db
    .selectFrom('cluster_gd_approval')
    .select('usuario_id')
    .where('clustergd_id', '=', clusterId)
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
  }
}
