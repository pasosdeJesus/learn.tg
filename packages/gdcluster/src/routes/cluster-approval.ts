import { NextRequest, NextResponse } from 'next/server'
import { addClusterHistory, getPastorChurch, getChurchCluster } from '../lib/gd-utils.js'
import { getClusterPastors } from '../lib/cluster-pastors.js'
import {
  getClusterApprovalSummary,
  getClusterApprovals,
  presentationDataHash,
  walletHash,
  type ApprovalPhase,
} from '../lib/cluster-approvals.js'
import {
  getPresentationReadiness,
  missingPresentationData,
  presentationMissingReasons,
} from '../lib/gd-presentation.js'
import { readClusterFunds } from '../lib/cluster-funds.js'
import type { GdclusterDeps } from '../index.js'

// Aprobación de los pastores (https://github.com/pasosdeJesus/learn.tg/issues/161,
// REQ/161 §4.7). Hay dos fases y cada una cierra un paso del proceso:
//
// - `wallet`: los tres pastores aprueban la billetera del clúster. Con la tercera
//   aprobación el estado pasa a `wallet_approved`, el fondo del clúster empieza a
//   existir y la billetera queda fija.
// - `data`: los tres pastores aprueban los cinco datos que se envían a GD. Con la
//   tercera aprobación el clúster pasa a `requested` (esa aprobación *es* la solicitud
//   a pdJ) y se comprueban las condiciones y que el fondo tenga dinero.

/**
 * Pastor principal de la iglesia iniciadora: es quien aprueba la billetera primero
 * (REQ/161 §4.7). Mientras no lo haga, nadie más puede aprobarla y la billetera sigue
 * siendo editable; desde su aprobación queda fija.
 */
async function initiatorPastorId(db: any, cluster: any): Promise<number | null> {
  if (!cluster.initiator_church_id) return null
  const row = await db
    .selectFrom('usuario')
    .select('id')
    .where('church_id', '=', cluster.initiator_church_id)
    .where('church_relationship', '=', 'pastor')
    .executeTakeFirst()
  return row?.id != null ? Number(row.id) : null
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

function phaseFrom(source: Record<string, unknown>): ApprovalPhase {
  const value = typeof source.phase === 'string' ? source.phase : ''
  return value === 'wallet' ? 'wallet' : 'data'
}

async function logEvent(db: any, usuarioId: number, eventType: string, eventData: unknown) {
  await db
    .insertInto('userevent')
    .values({
      usuario_id: usuarioId,
      event_type: eventType,
      event_data: JSON.stringify(eventData),
      created_at: new Date(),
    })
    .execute()
}

/**
 * POST /api/cluster/[id]/approval — { walletAddress, phase } o `?phase=wallet|data`.
 * Solo el pastor principal de una iglesia miembro. Idempotente: volver a pulsar
 * actualiza la fecha y el hash.
 */
export async function approvePresentation(
  deps: GdclusterDeps,
  req: NextRequest,
  params: Record<string, string>,
): Promise<Response> {
  const clusterId = parseInt(params?.id ?? '', 10)
  if (Number.isNaN(clusterId) || clusterId < 1) {
    return NextResponse.json({ error: 'Invalid cluster ID' }, { status: 400 })
  }
  try {
    const db = deps.db()
    const body = await req.json().catch(() => ({}))
    const { walletAddress } = body
    if (!walletAddress) return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    const auth = await deps.authenticateUser(db, walletAddress)
    if (!auth) return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })

    const phase = phaseFrom({ ...Object.fromEntries(req.nextUrl.searchParams), ...body })

    const cluster = await db.selectFrom('clustergd').selectAll().where('id', '=', clusterId).executeTakeFirst()
    if (!cluster) return NextResponse.json({ error: 'Cluster not found' }, { status: 404 })

    const status = (cluster.gd_status as string | null) ?? 'forming'

    // Primero el permiso: el estado del clúster no se le explica a quien no es pastor de
    // una iglesia miembro.
    if (auth.usuario.church_relationship !== 'pastor') {
      return NextResponse.json({ error: 'Only the principal pastor of a member church can approve' }, { status: 403 })
    }
    const pastors = await getClusterPastors(db, clusterId)
    if (!pastors.some((pastor) => pastor.usuario_id === Number(auth.usuario.id))) {
      return NextResponse.json({ error: 'Your church is not a member of this cluster' }, { status: 403 })
    }

    if (phase === 'wallet' && status !== 'forming') {
      return NextResponse.json(
        {
          error: 'The cluster wallet is already approved: it can no longer change',
          code: 'wallet_approval_closed',
        },
        { status: 409 },
      )
    }
    if (phase === 'data' && ['requested', 'under_review', 'sent', 'answered'].includes(status)) {
      return NextResponse.json(
        { error: 'The request is already with pdJ or with Global Disciples', code: 'approval_closed' },
        { status: 409 },
      )
    }
    // Los datos se aprueban cuando están completos: antes no hay nada que aprobar y el
    // hash cambiaría con cada edición (REQ/161 §4.7).
    // El estado de los datos es contabilidad: si los cinco ya están completos se puede
    // aprobar aunque el estado no haya avanzado todavía (REQ/161 §4.7).
    const dataComplete = missingPresentationData(cluster).length === 0
    if (phase === 'data' && !['waiting_for_pd_job_offer', 'returned'].includes(status) && !dataComplete) {
      return NextResponse.json(
        {
          error:
            'The presentation data cannot be approved yet: the wallet must be approved and the budget and the director offer uploaded first',
          code: 'data_approval_not_open',
        },
        { status: 409 },
      )
    }


    const wallet = await clusterWallet(db, cluster)
    const hash = phase === 'wallet' ? walletHash(wallet) : presentationDataHash(cluster)

    // La billetera la aprueba primero el iniciador, y desde su aprobación queda fija:
    // los demás pastores sólo pueden aprobar después (REQ/161 §4.7).
    if (phase === 'wallet') {
      const initiatorId = await initiatorPastorId(db, cluster)
      const current = await getClusterApprovals(db, clusterId, hash, 'wallet')
      const initiatorApproved = initiatorId != null && current.voters.includes(initiatorId)
      const isInitiatorPastor = initiatorId != null && initiatorId === Number(auth.usuario.id)
      if (!initiatorApproved && !isInitiatorPastor) {
        return NextResponse.json(
          {
            error:
              'The initiator pastor approves the cluster wallet first: until then the wallet can still change, so there is nothing for the other pastors to approve',
            code: 'initiator_must_approve_first',
          },
          { status: 409 },
        )
      }
    }
    await db
      .insertInto('cluster_gd_approval')
      .values({
        clustergd_id: clusterId,
        usuario_id: auth.usuario.id,
        phase,
        data_hash: hash,
        created_at: new Date(),
      })
      .onConflict((oc: any) =>
        oc.columns(['clustergd_id', 'usuario_id', 'phase']).doUpdateSet({
          data_hash: hash,
          created_at: new Date(),
        }),
      )
      .execute()

    const summary = await getClusterApprovalSummary(db, clusterId, cluster, wallet)
    const approvals = summary[phase]
    await logEvent(db, auth.usuario.id, `gd_${phase}_approved_by_pastor`, {
      cluster_id: clusterId,
      phase,
      approved: approvals.approved,
      pastors: approvals.pastors,
    })

    // La última aprobación mueve el estado (REQ/161 §4.7).
    // La aprobación del iniciador fija la billetera (REQ/161 §4.7).
    if (phase === 'wallet' && summary.wallet.voters.length > 0 && !cluster.wallet_fixed_at) {
      const initiatorId = await initiatorPastorId(db, cluster)
      if (initiatorId != null && summary.wallet.voters.includes(initiatorId)) {
        await db
          .updateTable('clustergd')
          .set({ wallet_fixed_at: new Date(), updated_at: new Date() })
          .where('id', '=', clusterId)
          .where('wallet_fixed_at', 'is', null)
          .execute()
      }
    }

    if (approvals.all_approved && phase === 'wallet' && status === 'forming') {
      const now = new Date()
      await db
        .updateTable('clustergd')
        .set({ gd_status: 'wallet_approved', updated_at: now })
        .where('id', '=', clusterId)
        .where('gd_status', '=', 'forming')
        .executeTakeFirst()
      await addClusterHistory(db, clusterId, 'gd_wallet_approved', status, 'wallet_approved', auth.usuario.id)
      await logEvent(db, auth.usuario.id, 'gd_wallet_approved', { cluster_id: clusterId })
    }

    if (approvals.all_approved && phase === 'data'
      && (['waiting_for_pd_job_offer', 'returned'].includes(status) || missingPresentationData(cluster).length === 0)) {
      const blocked = await requestBlocker(deps, db, clusterId, cluster)
      if (blocked) return blocked
      const now = new Date()
      const applied = await db
        .updateTable('clustergd')
        .set({
          gd_status: 'requested',
          gd_requested_at: now,
          gd_requested_by: auth.usuario.id,
          budget_fixed_at: cluster.budget_fixed_at ?? now,
          director_fixed_at: cluster.director_fixed_at ?? now,
          updated_at: now,
        })
        .where('id', '=', clusterId)
        .where('gd_status', '=', status)
        .executeTakeFirst()
      if (Number(applied?.numUpdatedRows ?? 0) > 0) {
        await addClusterHistory(db, clusterId, 'gd_presentation_requested', status, 'requested', auth.usuario.id)
        await logEvent(db, auth.usuario.id, 'gd_presentation_requested', { cluster_id: clusterId })
      }
    }

    const fresh = await db.selectFrom('clustergd').select('gd_status').where('id', '=', clusterId).executeTakeFirst()
    return NextResponse.json({
      success: true,
      phase,
      status: fresh?.gd_status ?? status,
      approvals,
      wallet_approvals: summary.wallet,
      data_approvals: summary.data,
    })
  } catch (error) {
    console.error('cluster approval error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * ¿Por qué no se puede pedir la presentación todavía? Devuelve la respuesta de error
 * con los mismos códigos que el antiguo POST, o `null` si todo está en orden.
 */
async function requestBlocker(deps: GdclusterDeps, db: any, clusterId: number, cluster: any) {
  const readiness = await getPresentationReadiness(db, clusterId)
  const missingData = missingPresentationData(cluster)
  if (!readiness.ready || missingData.length > 0) {
    return NextResponse.json(
      {
        error: 'The cluster is not ready to be presented',
        code: 'not_ready',
        reasons: presentationMissingReasons(readiness, missingData),
        missing: readiness.missing,
        missing_data: missingData,
      },
      { status: 400 },
    )
  }

  const wallet = await clusterWallet(db, cluster)
  const fund = await readClusterFunds({ backend: deps.backend } as any, wallet)
  if (!fund) {
    return NextResponse.json(
      {
        error: 'The cluster fund could not be read: try again in a few minutes',
        code: 'cluster_fund_unreadable',
      },
      { status: 503 },
    )
  }
  if (!fund.exists || (fund.usdt === 0n && fund.slearn === 0n)) {
    return NextResponse.json(
      {
        error:
          "The cluster fund has no money yet. A cluster can be presented once its fund receives the 10% of its churches' course purchases and scholarships: share the cluster donation link or wait for the students.",
        code: 'cluster_fund_empty',
      },
      { status: 409 },
    )
  }
  return null
}

/**
 * GET /api/cluster/[id]/approval?walletAddress=&phase= — estado de las aprobaciones.
 * Miembros del clúster o el iniciador; sin `phase` devuelve las dos.
 */
export async function getApprovals(
  deps: GdclusterDeps,
  req: NextRequest,
  params: Record<string, string>,
): Promise<Response> {
  const clusterId = parseInt(params?.id ?? '', 10)
  if (Number.isNaN(clusterId) || clusterId < 1) {
    return NextResponse.json({ error: 'Invalid cluster ID' }, { status: 400 })
  }
  try {
    const db = deps.db()
    const walletAddress = req.nextUrl.searchParams.get('walletAddress') || ''
    if (!walletAddress) return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    const auth = await deps.authenticateUser(db, walletAddress)
    if (!auth) return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })

    const cluster = await db.selectFrom('clustergd').selectAll().where('id', '=', clusterId).executeTakeFirst()
    if (!cluster) return NextResponse.json({ error: 'Cluster not found' }, { status: 404 })
    const church = await getPastorChurch(db, auth.usuario.id)
    const membership = church ? await getChurchCluster(db, church.id) : null
    if (!membership || membership.clustergd_id !== clusterId) {
      return NextResponse.json({ error: 'Your church is not a member of this cluster' }, { status: 403 })
    }

    const summary = await getClusterApprovalSummary(db, clusterId, cluster, await clusterWallet(db, cluster))
    const phase = req.nextUrl.searchParams.get('phase')
    if (phase === 'wallet' || phase === 'data') {
      return NextResponse.json(summary[phase])
    }
    return NextResponse.json({
      ...summary.data,
      wallet_phase: summary.wallet,
      data_phase: summary.data,
    })
  } catch (error) {
    console.error('cluster approvals get error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
