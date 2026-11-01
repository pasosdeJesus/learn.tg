import type { Kysely } from 'kysely'
import { getClusterMembers } from './gd-utils.js'

// Retiro del fondo del clúster (https://github.com/pasosdeJesus/learn.tg/issues/161).
// El retiro es total y solo procede cuando **todos** los pastores de las iglesias
// miembros han pulsado Withdraw; la primera pulsación saca al clúster del ranking.
//
// La liberación la ejecuta el backend (dueño de `ClusterFundsV2`) con
// `releaseClusterFunds` cuando todos los pastores han votado y GD respondió; desde ese
// momento el 10 % de las compras y becas de las iglesias del clúster va al fondo del país
// (`fund_released_at`).

export interface ClusterFundVote {
  usuario_id: number
  nombre: string | null
  church_id: number
  created_at: string | null
}

export interface ClusterFundVoteState {
  /** Pastores principales de las iglesias miembros (un voto por pastor). */
  pastors: number
  voted: number
  all_voted: boolean
  votes: ClusterFundVote[]
}

export interface ClusterFundRelease {
  /** Todos los pastores votaron: se puede liberar el fondo. */
  votes_complete: boolean
  /** El fondo alcanzó el 100 % del presupuesto del primer año. */
  budget_reached: boolean
  release_ready: boolean
  budget: number | null
  usdt: string | null
  slearn: string | null
}

export async function getClusterPastors(
  db: Kysely<any>,
  clusterId: number,
): Promise<{ usuario_id: number; nombre: string | null; church_id: number }[]> {
  const members = await getClusterMembers(db, clusterId)
  const pastors: { usuario_id: number; nombre: string | null; church_id: number }[] = []
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

export async function getClusterFundVotes(
  db: Kysely<any>,
  clusterId: number,
): Promise<ClusterFundVoteState> {
  const pastors = await getClusterPastors(db, clusterId)
  const pastorIds = new Set(pastors.map((pastor) => pastor.usuario_id))
  const rows = await db
    .selectFrom('cluster_fund_vote as v')
    .innerJoin('usuario as u', 'u.id', 'v.usuario_id')
    .select(['v.usuario_id', 'u.nombre', 'u.church_id', 'v.created_at'])
    .where('v.clustergd_id', '=', clusterId)
    .orderBy('v.created_at', 'asc')
    .execute()

  // Un pastor que dejó la iglesia o el clúster pierde su voto: solo cuentan los
  // pastores actuales, así que los votos viejos no completan el retiro.
  const votes: ClusterFundVote[] = (rows as any[])
    .filter((row) => pastorIds.has(Number(row.usuario_id)))
    .map((row) => ({
      usuario_id: Number(row.usuario_id),
      nombre: row.nombre ?? null,
      church_id: Number(row.church_id ?? 0),
      created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    }))

  return {
    pastors: pastors.length,
    voted: votes.length,
    all_voted: pastors.length > 0 && votes.length >= pastors.length,
    votes,
  }
}

/**
 * ¿Puede liberarse el fondo? Dos disparadores: todos los pastores votaron o el saldo
 * del fondo alcanzó el 100 % del presupuesto fijado para el primer año.
 */
export function computeRelease(
  votes: ClusterFundVoteState,
  budget: number | null,
  balance: { usdt: bigint; slearn: bigint } | null,
  usdtDecimals = 6,
  slearnDecimals = 2,
): ClusterFundRelease {
  const usdt = balance ? Number(balance.usdt) / 10 ** usdtDecimals : null
  const slearn = balance ? Number(balance.slearn) / 10 ** slearnDecimals : null
  const budgetReached = !!budget && budget > 0 && usdt !== null && usdt >= budget
  return {
    votes_complete: votes.all_voted,
    budget_reached: budgetReached,
    release_ready: budgetReached || votes.all_voted,
    budget: budget ?? null,
    usdt: usdt === null ? null : usdt.toFixed(2),
    slearn: slearn === null ? null : slearn.toFixed(2),
  }
}
