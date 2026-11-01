import { NextRequest, NextResponse } from 'next/server'
import { formatUnits } from 'viem'
import ClusterFundsV2Abi from '../abis/ClusterFundsV2.json'
import { getPastorChurch, getChurchCluster, addClusterHistory } from '../lib/gd-utils.js'
import { readClusterFunds } from '../lib/cluster-funds.js'
import { computeRelease, getClusterFundVotes } from '../lib/cluster-fund-votes.js'
import { getClusterFundsAddress } from '../lib/gd-cluster-routing.js'
import type { GdclusterDeps } from '../index.js'

// Retiro del fondo del clúster (https://github.com/pasosdeJesus/learn.tg/issues/161).
//
// Los botones de Retirar se habilitan cuando Global Disciples respondió (estado
// `answered` de la presentación). El retiro es total, no parcial: cuando **todos** los
// pastores de las iglesias miembros han pulsado Retirar, el backend (dueño de
// `ClusterFundsV2`) libera el fondo a la billetera del clúster con
// `releaseClusterFunds`, y desde ese momento (`fund_released_at`) el 10 % de las compras y
// becas de esas iglesias va al fondo del país, porque ya no hay fondo de clúster.
//
// La primera pulsación saca al clúster del ranking (`ranking_exited_at`), pero el 10 %
// sigue llegando al clúster hasta que el fondo se libere.

const USDT_DECIMALS = 6
const SLEARN_DECIMALS = 2

function clusterIdFrom(params: Record<string, string>): number | null {
  const clusterId = parseInt(params?.id ?? '', 10)
  return Number.isNaN(clusterId) || clusterId < 1 ? null : clusterId
}

async function memberContext(deps: GdclusterDeps, walletAddress: string, clusterId: number) {
  const db = deps.db()
  const auth = await deps.authenticateUser(db, walletAddress)
  if (!auth) return { error: NextResponse.json({ error: 'Authentication failed' }, { status: 401 }) }
  const cluster = await db.selectFrom('clustergd').selectAll().where('id', '=', clusterId).executeTakeFirst()
  if (!cluster) return { error: NextResponse.json({ error: 'Cluster not found' }, { status: 404 }) }
  const church = await getPastorChurch(db, auth.usuario.id)
  const membership = church ? await getChurchCluster(db, church.id) : null
  const isInitiator = !!(church && cluster.initiator_church_id === church.id)
  const isMember = !!membership && membership.clustergd_id === clusterId
  return { db, auth, cluster, church, isInitiator, isMember }
}

async function clusterWallet(db: any, cluster: any): Promise<string | null> {
  if (!cluster.initiator_church_id) return null
  const row = await db
    .selectFrom('church')
    .select('cluster_wallet')
    .where('id', '=', cluster.initiator_church_id)
    .executeTakeFirst()
  return row?.cluster_wallet ?? null
}

async function stateFor(deps: GdclusterDeps, db: any, cluster: any) {
  const votes = await getClusterFundVotes(db, cluster.id)
  const wallet = await clusterWallet(db, cluster)
  const balance = wallet ? await readClusterFunds(deps, wallet) : null
  const budget = cluster.first_year_budget === null || cluster.first_year_budget === undefined
    ? null
    : Number(cluster.first_year_budget)
  return {
    votes,
    wallet,
    gd_status: cluster.gd_status ?? null,
    armed: cluster.gd_status === 'answered',
    ranking_exited_at: cluster.ranking_exited_at ? new Date(cluster.ranking_exited_at).toISOString() : null,
    fund_released_at: cluster.fund_released_at ? new Date(cluster.fund_released_at).toISOString() : null,
    release: computeRelease(votes, budget, balance, USDT_DECIMALS, SLEARN_DECIMALS),
  }
}

/**
 * GET /api/cluster/[id]/withdraw?walletAddress= — quién votó, si los botones están
 * habilitados (`armed`: GD respondió) y si el fondo ya puede liberarse.
 */
export async function getWithdrawState(deps: GdclusterDeps, req: NextRequest, params: Record<string, string>): Promise<Response> {
  const clusterId = clusterIdFrom(params)
  if (!clusterId) return NextResponse.json({ error: 'Invalid cluster ID' }, { status: 400 })
  try {
    const walletAddress = req.nextUrl.searchParams.get('walletAddress') || ''
    if (!walletAddress) return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    const ctx = await memberContext(deps, walletAddress, clusterId)
    const failure = (ctx as { error?: NextResponse }).error
    if (failure) return failure
    if (!ctx.isMember && !ctx.isInitiator) {
      return NextResponse.json({ error: 'Your church is not a member of this cluster' }, { status: 403 })
    }
    const canVote = ctx.isMember
      && ctx.auth.usuario.church_relationship === 'pastor'
      && ctx.cluster.gd_status === 'answered'
      && !ctx.cluster.fund_released_at
    return NextResponse.json({ can_vote: canVote, ...(await stateFor(deps, ctx.db, ctx.cluster)) })
  } catch (error) {
    console.error('cluster withdraw get error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/cluster/[id]/withdraw — { walletAddress }. El pastor principal de una
 * iglesia miembro registra su Retirar (idempotente). Solo cuando GD respondió; si con
 * este voto están todos, se libera el fondo a la billetera del clúster.
 */
export async function castWithdrawVote(deps: GdclusterDeps, req: NextRequest, params: Record<string, string>): Promise<Response> {
  const clusterId = clusterIdFrom(params)
  if (!clusterId) return NextResponse.json({ error: 'Invalid cluster ID' }, { status: 400 })
  try {
    const { walletAddress } = await req.json().catch(() => ({}))
    if (!walletAddress) return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    const ctx = await memberContext(deps, walletAddress, clusterId)
    const failure = (ctx as { error?: NextResponse }).error
    if (failure) return failure
    if (!ctx.isMember) {
      return NextResponse.json({ error: 'Only the pastors of the cluster can vote' }, { status: 403 })
    }
    if (ctx.auth.usuario.church_relationship !== 'pastor') {
      return NextResponse.json({ error: 'Only the principal pastor of a member church can vote' }, { status: 403 })
    }
    if (ctx.cluster.fund_released_at) {
      return NextResponse.json(
        { error: 'The cluster fund was already released', code: 'already_released' },
        { status: 409 },
      )
    }
    if (ctx.cluster.gd_status !== 'answered') {
      return NextResponse.json(
        { error: 'The Withdraw buttons are enabled when Global Disciples answers', code: 'gd_not_answered' },
        { status: 409 },
      )
    }
    const wallet = await clusterWallet(ctx.db, ctx.cluster)
    if (!wallet) {
      return NextResponse.json(
        { error: 'The cluster has no wallet: the fund stays in the contract', code: 'no_cluster_wallet' },
        { status: 409 },
      )
    }

    const inserted = await ctx.db
      .insertInto('cluster_fund_vote')
      .values({ clustergd_id: clusterId, usuario_id: ctx.auth.usuario.id, created_at: new Date() })
      .onConflict((oc: any) => oc.columns(['clustergd_id', 'usuario_id']).doNothing())
      .returning('usuario_id')
      .executeTakeFirst()

    const now = new Date()
    if (!ctx.cluster.ranking_exited_at) {
      // La primera pulsación saca al clúster del ranking (irreversible); el 10 % sigue
      // llegando al clúster hasta que el fondo se libere.
      await ctx.db
        .updateTable('clustergd')
        .set({ ranking_exited_at: now, updated_at: now })
        .where('id', '=', clusterId)
        .execute()
      await addClusterHistory(ctx.db, clusterId, 'fund_withdraw_started', null, 'first_vote', ctx.auth.usuario.id)
    }
    if (inserted) {
      await addClusterHistory(ctx.db, clusterId, 'fund_withdraw_vote', null, 'withdraw', ctx.auth.usuario.id)
      await ctx.db.insertInto('userevent')
        .values({
          usuario_id: ctx.auth.usuario.id,
          event_type: 'cluster_fund_withdraw_vote',
          event_data: JSON.stringify({ cluster_id: clusterId }),
          created_at: now,
        })
        .execute()
    }

    let releaseHash: string | null = null
    const votes = await getClusterFundVotes(ctx.db, clusterId)
    if (votes.all_voted) {
      try {
        releaseHash = await releaseClusterFund(deps, ctx.db, ctx.cluster, wallet, ctx.auth.usuario.id)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('cluster fund release failed:', message)
        const cluster = await ctx.db.selectFrom('clustergd').selectAll().where('id', '=', clusterId).executeTakeFirst()
        if (!cluster) return NextResponse.json({ error: 'Cluster not found' }, { status: 404 })
        return NextResponse.json(
          { error: 'The fund could not be released', code: 'release_failed', detail: message, ...(await stateFor(deps, ctx.db, cluster)) },
          { status: 502 },
        )
      }
    }

    const cluster = await ctx.db.selectFrom('clustergd').selectAll().where('id', '=', clusterId).executeTakeFirst()
    if (!cluster) return NextResponse.json({ error: 'Cluster not found' }, { status: 404 })
    return NextResponse.json({
      success: true,
      can_vote: !cluster.fund_released_at,
      release_hash: releaseHash,
      ...(await stateFor(deps, ctx.db, cluster)),
    })
  } catch (error) {
    console.error('cluster withdraw vote error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Libera el fondo del clúster a su billetera con `releaseClusterFunds` (el backend es el
 * dueño del contrato) y registra `fund_released_at` y los montos. Desde ese momento el
 * 10 % de las compras y becas de las iglesias del clúster va al fondo del país.
 */
async function releaseClusterFund(
  deps: GdclusterDeps,
  db: any,
  cluster: any,
  wallet: string,
  usuarioId: number,
): Promise<string> {
  const balance = await readClusterFunds(deps, wallet)
  if (!balance || (balance.usdt <= 0n && balance.slearn <= 0n)) {
    throw new Error('The cluster fund has no balance to release')
  }

  const publicClient = deps.backend.getPublicClient()
  const walletClient = deps.backend.getWalletClient()
  const account = walletClient.account
  const address = await getClusterFundsAddress()
  const nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' })

  const hash = await deps.backend.sendTxAndWait(walletClient, publicClient, {
    address,
    abi: ClusterFundsV2Abi as any,
    functionName: 'releaseClusterFunds',
    args: [wallet],
    account,
    chain: publicClient.chain,
    nonce,
  })

  const now = new Date()
  await db
    .updateTable('clustergd')
    .set({
      fund_released_at: now,
      fund_released_amount: formatUnits(balance.usdt, USDT_DECIMALS),
      fund_released_slearn: formatUnits(balance.slearn, SLEARN_DECIMALS),
      updated_at: now,
    })
    .where('id', '=', cluster.id)
    .execute()

  await addClusterHistory(db, cluster.id, 'fund_released', null, hash, usuarioId)
  await db.insertInto('userevent')
    .values({
      usuario_id: usuarioId,
      event_type: 'cluster_fund_released',
      event_data: JSON.stringify({ cluster_id: cluster.id, hash, wallet }),
      created_at: now,
    })
    .execute()

  return hash
}
