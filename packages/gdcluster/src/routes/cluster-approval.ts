import { NextRequest, NextResponse } from 'next/server'
import { getPastorChurch, getChurchCluster } from '../lib/gd-utils.js'
import { getClusterPastors } from '../lib/cluster-pastors.js'
import { getClusterApprovals, presentationDataHash } from '../lib/cluster-approvals.js'
import type { GdclusterDeps } from '../index.js'

// Aprobación de los pastores para presentar el clúster a Global Disciples
// (https://github.com/pasosdeJesus/learn.tg/issues/161). El pastor principal de cada
// iglesia miembro pulsa el botón y confirma que conoce y aprueba lo que se enviará a GD
// (presupuesto del primer año y oferta del director) y la billetera del clúster. La
// aprobación guarda el hash de esos datos: si cambian, caduca.

async function clusterWallet(db: any, cluster: any): Promise<string | null> {
  if (!cluster.initiator_church_id) return null
  const row = await db
    .selectFrom('church')
    .select('cluster_wallet')
    .where('id', '=', cluster.initiator_church_id)
    .executeTakeFirst()
  return row?.cluster_wallet ?? null
}

/**
 * POST /api/cluster/[id]/approval — { walletAddress }. Solo el pastor principal de una
 * iglesia miembro. Idempotente: volver a pulsar actualiza la fecha y el hash.
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
    const { walletAddress } = await req.json().catch(() => ({}))
    if (!walletAddress) return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    const auth = await deps.authenticateUser(db, walletAddress)
    if (!auth) return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })

    const cluster = await db.selectFrom('clustergd').selectAll().where('id', '=', clusterId).executeTakeFirst()
    if (!cluster) return NextResponse.json({ error: 'Cluster not found' }, { status: 404 })

    if (['under_review', 'approved', 'sent', 'answered'].includes(cluster.gd_status)) {
      return NextResponse.json(
        { error: 'The request is already with pdJ or with Global Disciples', code: 'approval_closed' },
        { status: 409 },
      )
    }

    if (auth.usuario.church_relationship !== 'pastor') {
      return NextResponse.json({ error: 'Only the principal pastor of a member church can approve' }, { status: 403 })
    }
    const pastors = await getClusterPastors(db, clusterId)
    if (!pastors.some((pastor) => pastor.usuario_id === Number(auth.usuario.id))) {
      return NextResponse.json({ error: 'Your church is not a member of this cluster' }, { status: 403 })
    }

    const wallet = await clusterWallet(db, cluster)
    const hash = presentationDataHash(cluster, wallet)
    await db
      .insertInto('cluster_gd_approval')
      .values({ clustergd_id: clusterId, usuario_id: auth.usuario.id, data_hash: hash, created_at: new Date() })
      .onConflict((oc: any) => oc.columns(['clustergd_id', 'usuario_id']).doUpdateSet({
        data_hash: hash,
        created_at: new Date(),
      }))
      .execute()

    const approvals = await getClusterApprovals(db, clusterId, hash)
    await db.insertInto('userevent')
      .values({
        usuario_id: auth.usuario.id,
        event_type: 'gd_presentation_approved_by_pastor',
        event_data: JSON.stringify({ cluster_id: clusterId, approved: approvals.approved, pastors: approvals.pastors }),
        created_at: new Date(),
      })
      .execute()

    return NextResponse.json({ success: true, approvals })
  } catch (error) {
    console.error('cluster approval error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/cluster/[id]/approval?walletAddress= — estado de aprobaciones del clúster.
 * Miembros del clúster o el iniciador.
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

    const hash = presentationDataHash(cluster, await clusterWallet(db, cluster))
    return NextResponse.json(await getClusterApprovals(db, clusterId, hash))
  } catch (error) {
    console.error('cluster approvals get error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
