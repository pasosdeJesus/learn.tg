import { NextRequest, NextResponse } from 'next/server'
import { getPastorChurch, getChurchCluster, addClusterHistory } from '../lib/gd-utils.js'
import { getPresentationReadiness } from '../lib/gd-presentation.js'
import type { GdclusterDeps } from '../index.js'

// Presentación de un clúster a Global Disciples (R-#161, 2026-10-27).
// El iniciador del clúster pide la presentación cuando se cumplen las condiciones
// (`lib/gd-presentation.ts`); pdJ escribe a su contacto en GD y registra el envío, la
// respuesta y el correo/canal para seguir directamente. La app no envía correos.

function clusterIdFrom(params: Record<string, string>): number | null {
  const clusterId = parseInt(params?.id ?? '', 10)
  return Number.isNaN(clusterId) || clusterId < 1 ? null : clusterId
}

async function viewerContext(deps: GdclusterDeps, db: any, walletAddress: string, clusterId: number) {
  const auth = await deps.authenticateUser(db, walletAddress)
  if (!auth) return { error: NextResponse.json({ error: 'Authentication failed' }, { status: 401 }) }
  const cluster = await db.selectFrom('clustergd').selectAll().where('id', '=', clusterId).executeTakeFirst()
  if (!cluster) return { error: NextResponse.json({ error: 'Cluster not found' }, { status: 404 }) }
  const church = await getPastorChurch(db, auth.usuario.id)
  const membership = church ? await getChurchCluster(db, church.id) : null
  const isInitiator = !!(church && cluster.initiator_church_id === church.id)
  const isMember = !!membership && membership.clustergd_id === clusterId
  return { auth, cluster, church, isInitiator, isMember }
}

/**
 * GET /api/cluster/[id]/gd-presentation?walletAddress= — condiciones y estado.
 * Solo para pastores miembros del clúster (o el iniciador). La respuesta de GD y el
 * correo de contacto se muestran únicamente al iniciador.
 */
export async function getPresentation(deps: GdclusterDeps, req: NextRequest, params: Record<string, string>) {
  const clusterId = clusterIdFrom(params)
  if (!clusterId) return NextResponse.json({ error: 'Invalid cluster ID' }, { status: 400 })

  try {
    const db = deps.db()
    const walletAddress = req.nextUrl.searchParams.get('walletAddress') || ''
    if (!walletAddress) return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })

    const ctx = await viewerContext(deps, db, walletAddress, clusterId)
    if (ctx.error) return ctx.error
    if (!ctx.isMember && !ctx.isInitiator) {
      return NextResponse.json({ error: 'Your church is not a member of this cluster' }, { status: 403 })
    }

    const readiness = await getPresentationReadiness(db, clusterId)
    const request = readiness.request
    return NextResponse.json({
      ...readiness,
      isInitiator: ctx.isInitiator,
      isMember: ctx.isMember,
      request: request
        ? {
            requested_at: request.requested_at,
            requested_by: request.requested_by,
            sent_at: request.sent_at,
            ...(ctx.isInitiator
              ? {
                  response: request.response,
                  response_at: request.response_at,
                  contact_email: request.contact_email,
                }
              : {}),
          }
        : null,
    })
  } catch (error) {
    console.error('gd-presentation get error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/cluster/[id]/gd-presentation — el iniciador solicita la presentación.
 * Idempotente: si ya fue solicitada, responde 200 con el estado.
 */
export async function requestPresentation(deps: GdclusterDeps, req: NextRequest, params: Record<string, string>) {
  const clusterId = clusterIdFrom(params)
  if (!clusterId) return NextResponse.json({ error: 'Invalid cluster ID' }, { status: 400 })

  try {
    const db = deps.db()
    const { walletAddress } = await req.json().catch(() => ({}))
    if (!walletAddress) return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })

    const ctx = await viewerContext(deps, db, walletAddress, clusterId)
    if (ctx.error) return ctx.error
    if (!ctx.isInitiator) {
      return NextResponse.json({ error: 'Only the cluster initiator can request the presentation' }, { status: 403 })
    }

    const readiness = await getPresentationReadiness(db, clusterId)
    if (readiness.request?.requested_at) {
      return NextResponse.json({ success: true, alreadyRequested: true, request: readiness.request })
    }
    if (!readiness.ready) {
      return NextResponse.json(
        {
          error: 'The cluster is not ready to be presented',
          missing: readiness.missing,
          pastors: readiness.pastors.map((pastor) => ({
            usuario_id: pastor.usuario_id,
            church_name: pastor.church_name,
            missing: pastor.missing,
          })),
        },
        { status: 400 },
      )
    }

    await db
      .updateTable('clustergd')
      .set({ gd_requested_at: new Date(), gd_requested_by: ctx.auth.usuario.id, updated_at: new Date() })
      .where('id', '=', clusterId)
      .execute()

    await addClusterHistory(db, clusterId, 'gd_presentation_requested', null, ctx.cluster.name, ctx.auth.usuario.id)
    await logEvent(db, ctx.auth.usuario.id, 'gd_presentation_requested', { cluster_id: clusterId })

    return NextResponse.json({
      success: true,
      request: {
        requested_at: new Date().toISOString(),
        requested_by: ctx.auth.usuario.id,
      },
    })
  } catch (error) {
    console.error('gd-presentation request error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function logEvent(db: any, usuarioId: number, eventType: string, eventData: unknown): Promise<void> {
  await db.insertInto('userevent')
    .values({ usuario_id: usuarioId, event_type: eventType, event_data: JSON.stringify(eventData), created_at: new Date() })
    .execute()
}
