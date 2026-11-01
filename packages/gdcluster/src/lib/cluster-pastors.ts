import type { Kysely } from 'kysely'
import { getClusterMembers } from './gd-utils.js'

// Pastores principales de las iglesias de un clúster: son los que aprueban la
// presentación a Global Disciples y los que cuentan para "X de Y aprobaron"
// (https://github.com/pasosdeJesus/learn.tg/issues/161).

export interface ClusterPastor {
  usuario_id: number
  nombre: string | null
  church_id: number
}

export async function getClusterPastors(db: Kysely<any>, clusterId: number): Promise<ClusterPastor[]> {
  const members = await getClusterMembers(db, clusterId)
  const pastors: ClusterPastor[] = []
  for (const member of members) {
    const pastor = await db
      .selectFrom('usuario')
      .select(['id', 'nombre'])
      .where('church_id', '=', member.church_id)
      .where('church_relationship', '=', 'pastor')
      .executeTakeFirst()
    if (pastor?.id) {
      pastors.push({ usuario_id: Number(pastor.id), nombre: pastor.nombre ?? null, church_id: Number(member.church_id) })
    }
  }
  return pastors
}
