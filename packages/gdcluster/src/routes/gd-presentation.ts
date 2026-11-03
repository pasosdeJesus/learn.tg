import { NextRequest, NextResponse } from 'next/server'
import { getPastorChurch, getChurchCluster, addClusterHistory, notifyUser } from '../lib/gd-utils.js'
import { setClusterVerified } from '../lib/cluster-funds.js'
import { releaseOnAnswered } from '../lib/cluster-release.js'
import {
  GD_PRESENTATION_STATUSES,
  canTransitionPresentation,
  getPresentationReadiness,
  missingPresentationData,
  type GdPresentationStatus,
} from '../lib/gd-presentation.js'
import type { GdclusterDeps } from '../index.js'

// Presentación de un clúster a Global Disciples (https://github.com/pasosdeJesus/learn.tg/issues/161).
// El iniciador pide la presentación cuando se cumplen las condiciones y están los cinco
// datos (presupuesto del primer año y oferta del director); esos datos quedan fijos
// (read-only). pdJ mueve el estado (`PUT`, solo admin): revisa, devuelve con
// sugerencias, aprueba y envía; al registrar la respuesta de GD el estado queda
// `answered`. El iniciador puede cancelar mientras el estado siga en `requested`.
// La app no envía correos: pdJ copia el mensaje sugerido y lo envía desde su cliente.
// **Presentada = verificada en el contrato** (decisión del operador, 2026-10-22): cuando pdJ
// marca `sent`, el backend llama `ClusterFundsV2.setClusterVerification(wallet, true)`, de
// modo que varios clústeres presentados quedan verificados a la vez y pdJ puede repartir el
// fondo del país entre ellos (un solo clúster no se lleva todo).

const LOCK_HISTORY: Record<string, string> = {
  requested: 'gd_presentation_requested',
  under_review: 'gd_presentation_under_review',
  returned: 'gd_presentation_returned',
  approved: 'gd_presentation_approved',
  sent: 'gd_presentation_sent',
  answered: 'gd_presentation_answered',
  cancelled: 'gd_presentation_cancelled',
}

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

async function initiatorPastor(db: any, cluster: any) {
  if (!cluster.initiator_church_id) return null
  return db
    .selectFrom('church as c')
    .innerJoin('usuario as u', 'u.church_id', 'c.id')
    .select(['u.id as usuario_id', 'u.idioma as idioma'])
    .where('c.id', '=', cluster.initiator_church_id)
    .where('u.church_relationship', '=', 'pastor')
    .executeTakeFirst()
}

/**
 * GET /api/cluster/[id]/gd-presentation?walletAddress= — condiciones, datos fijos y
 * estado. Solo para pastores miembros del clúster (o el iniciador). La evaluación, las
 * sugerencias, la respuesta de GD y el correo de contacto se muestran al iniciador.
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
    const canApprove = ctx.isMember
      && ctx.auth.usuario.church_relationship === 'pastor'
      && !['under_review', 'approved', 'sent', 'answered'].includes(ctx.cluster.gd_status)
      && !(readiness.approvals?.voters ?? []).includes(Number(ctx.auth.usuario.id))
    return NextResponse.json({
      ...readiness,
      isInitiator: ctx.isInitiator,
      isMember: ctx.isMember,
      can_approve: canApprove,
      request: request
        ? {
            status: request.status,
            locked: request.locked,
            requested_at: request.requested_at,
            requested_by: request.requested_by,
            sent_at: request.sent_at,
            budget_fixed_at: request.budget_fixed_at,
            director_fixed_at: request.director_fixed_at,
            first_year_budget: request.first_year_budget,
            budget_draft_path: request.budget_draft_path,
            director_offer_path: request.director_offer_path,
            director_first_year_pay: request.director_first_year_pay,
            director_first_year_hours: request.director_first_year_hours,
            ...(ctx.isInitiator
              ? {
                  reviewed_at: request.reviewed_at,
                  returned_at: request.returned_at,
                  approved_at: request.approved_at,
                  answered_at: request.answered_at,
                  evaluation: request.evaluation,
                  suggestions: request.suggestions,
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
 * Idempotente mientras el estado la mantenga solicitada. Exige los cinco datos.
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

    const status = (ctx.cluster.gd_status as string | null) ?? null
    if (status === 'returned') {
      return NextResponse.json(
        { error: 'The request was returned to you: correct the data and pdJ approves it again' },
        { status: 409 },
      )
    }
    // Solicitud vigente: `cancelled` la borra y un clúster anterior a `gd_status` que ya
    // tenía `gd_requested_at` sigue contando como solicitado.
    const active = status
      ? status !== 'cancelled'
      : !!ctx.cluster.gd_requested_at
    if (active) {
      const readiness = await getPresentationReadiness(db, clusterId)
      return NextResponse.json({ success: true, alreadyRequested: true, request: readiness.request })
    }

    const missingData = missingPresentationData(ctx.cluster)
    const readiness = await getPresentationReadiness(db, clusterId)
    if (!readiness.ready || missingData.length > 0) {
      return NextResponse.json(
        {
          error: 'The cluster is not ready to be presented',
          missing: readiness.missing,
          missing_data: missingData,
          pastors: readiness.pastors.map((pastor) => ({
            usuario_id: pastor.usuario_id,
            church_name: pastor.church_name,
            missing: pastor.missing,
          })),
        },
        { status: 400 },
      )
    }

    const now = new Date()
    await db
      .updateTable('clustergd')
      .set({
        gd_status: 'requested',
        gd_requested_at: now,
        gd_requested_by: ctx.auth.usuario.id,
        budget_fixed_at: now,
        director_fixed_at: now,
        updated_at: now,
      })
      .where('id', '=', clusterId)
      .execute()

    await addClusterHistory(db, clusterId, LOCK_HISTORY.requested, status, 'requested', ctx.auth.usuario.id)
    await logEvent(db, ctx.auth.usuario.id, 'gd_presentation_requested', { cluster_id: clusterId })

    return NextResponse.json({
      success: true,
      request: {
        status: 'requested',
        locked: true,
        requested_at: now.toISOString(),
        requested_by: ctx.auth.usuario.id,
      },
    })
  } catch (error) {
    console.error('gd-presentation request error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/cluster/[id]/gd-presentation — pdJ mueve el estado: revisa, devuelve con
 * sugerencias, aprueba, envía y registra la respuesta de GD. Solo admin/verificador.
 */
export async function updatePresentation(deps: GdclusterDeps, req: NextRequest, params: Record<string, string>) {
  const clusterId = clusterIdFrom(params)
  if (!clusterId) return NextResponse.json({ error: 'Invalid cluster ID' }, { status: 400 })

  try {
    const db = deps.db()
    const body = await req.json().catch(() => ({}))
    const { walletAddress, status, evaluation, suggestions, response, contactEmail } = body
    if (!walletAddress) return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    if (!deps.authenticateAdmin) {
      return NextResponse.json({ error: 'Admin authentication is not configured' }, { status: 503 })
    }
    const admin = await deps.authenticateAdmin(db, walletAddress)
    if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

    if (!GD_PRESENTATION_STATUSES.includes(status as GdPresentationStatus)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const cluster = await db.selectFrom('clustergd').selectAll().where('id', '=', clusterId).executeTakeFirst()
    if (!cluster) return NextResponse.json({ error: 'Cluster not found' }, { status: 404 })
    if (!cluster.gd_requested_at) {
      return NextResponse.json({ error: 'The cluster has not requested the presentation' }, { status: 409 })
    }
    if (status === 'cancelled') {
      return NextResponse.json({ error: 'Only the initiator can cancel the request' }, { status: 403 })
    }
    if (!canTransitionPresentation(cluster.gd_status, status)) {
      return NextResponse.json(
        { error: `Cannot move the presentation from ${cluster.gd_status ?? 'no status'} to ${status}` },
        { status: 409 },
      )
    }

    const now = new Date()
    const updates: Record<string, unknown> = { gd_status: status, updated_at: now }
    // `requested` y `approved` fijan los cinco datos; `returned` los desbloquea.
    if (status === 'requested' || status === 'approved') {
      updates.budget_fixed_at = cluster.budget_fixed_at ?? now
      updates.director_fixed_at = cluster.director_fixed_at ?? now
    }
    if (status === 'under_review') updates.gd_reviewed_at = now
    if (status === 'returned') {
      updates.gd_returned_at = now
      updates.gd_evaluation = text(evaluation) ?? cluster.gd_evaluation ?? null
      updates.gd_suggestions = text(suggestions) ?? cluster.gd_suggestions ?? null
      updates.budget_fixed_at = null
      updates.director_fixed_at = null
    }
    if (status === 'approved') {
      updates.gd_approved_at = now
      updates.gd_evaluation = text(evaluation) ?? cluster.gd_evaluation ?? null
      updates.gd_suggestions = text(suggestions) ?? cluster.gd_suggestions ?? null
    }
    if (status === 'sent') {
      // Presentada en la base de datos = verificada en el contrato.
      const wallet = await initiatorClusterWallet(db, cluster)
      if (!wallet) {
        return NextResponse.json(
          { error: 'The cluster has no wallet: it cannot be verified in the contract', code: 'no_cluster_wallet' },
          { status: 409 },
        )
      }
      try {
        await setClusterVerified(deps as any, wallet)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('cluster verification failed:', message)
        return NextResponse.json(
          { error: 'The cluster could not be verified in the contract', code: 'verification_failed', detail: message },
          { status: 502 },
        )
      }
      updates.gd_sent_at = now
      updates.gd_sent_by = admin.usuario_id
    }
    if (status === 'answered') {
      updates.gd_answered_at = now
      updates.gd_response_at = now
      updates.gd_response_by = admin.usuario_id
      updates.gd_response = text(response) ?? cluster.gd_response ?? null
      updates.gd_contact_email = text(contactEmail) ?? cluster.gd_contact_email ?? null
    }

    await db.updateTable('clustergd').set(updates).where('id', '=', clusterId).execute()
    await addClusterHistory(db, clusterId, LOCK_HISTORY[status], cluster.gd_status ?? null, status, admin.usuario_id)
    await logEvent(db, admin.usuario_id, LOCK_HISTORY[status], { cluster_id: clusterId })

    if (status === 'returned' || status === 'answered') {
      const initiator = await initiatorPastor(db, cluster)
      if (initiator?.usuario_id) {
        const es = String(initiator.idioma || 'en').startsWith('es')
        const title = status === 'returned'
          ? (es ? 'pdJ devolvió la solicitud de presentación' : 'pdJ returned the presentation request')
          : (es ? 'Global Disciples respondió' : 'Global Disciples answered')
        const content = status === 'returned'
          ? (es
              ? 'Revisa las sugerencias en la página del clúster, corrige el presupuesto o la oferta del director y vuelve a enviarla.'
              : 'Read the suggestions on the cluster page, correct the budget or the director offer and submit it again.')
          : (es
              ? 'La página del clúster tiene la respuesta y el correo o canal para continuar directamente con Global Disciples.'
              : 'The cluster page has the answer and the email or channel to continue directly with Global Disciples.')
        await notifyUser(
          db,
          Number(initiator.usuario_id),
          'gd_presentation',
          title,
          content,
          `/${es ? 'es' : 'en'}/cluster/${clusterId}`,
        )
      }
    }

    // Al responder GD se liberan los fondos (país repartido entre los presentados y el
    // fondo del clúster a su billetera). Un fallo no deshace la respuesta registrada.
    let release: { distribution: string | null; release: string | null; errors: string[] } | null = null
    if (status === 'answered') {
      release = await releaseOnAnswered(deps as any, db, { ...cluster, gd_status: 'answered' }, admin.usuario_id)
    }

    const readiness = await getPresentationReadiness(db, clusterId)
    return NextResponse.json({ success: true, request: readiness.request, ...(release ? { release } : {}) })
  } catch (error) {
    console.error('gd-presentation update error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/cluster/[id]/gd-presentation — el iniciador retira la solicitud antes de
 * que pdJ la revise (`requested` → `cancelled`) y los cinco datos se desbloquean.
 */
export async function cancelPresentation(deps: GdclusterDeps, req: NextRequest, params: Record<string, string>) {
  const clusterId = clusterIdFrom(params)
  if (!clusterId) return NextResponse.json({ error: 'Invalid cluster ID' }, { status: 400 })

  try {
    const db = deps.db()
    const walletAddress = req.nextUrl.searchParams.get('walletAddress') || ''
    if (!walletAddress) return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })

    const ctx = await viewerContext(deps, db, walletAddress, clusterId)
    if (ctx.error) return ctx.error
    if (!ctx.isInitiator) {
      return NextResponse.json({ error: 'Only the cluster initiator can cancel the request' }, { status: 403 })
    }
    if (ctx.cluster.gd_status !== 'requested') {
      return NextResponse.json(
        { error: 'The request can only be cancelled before pdJ reviews it' },
        { status: 409 },
      )
    }

    await db
      .updateTable('clustergd')
      .set({ gd_status: 'cancelled', budget_fixed_at: null, director_fixed_at: null, updated_at: new Date() })
      .where('id', '=', clusterId)
      .execute()

    await addClusterHistory(db, clusterId, LOCK_HISTORY.cancelled, 'requested', 'cancelled', ctx.auth.usuario.id)
    await logEvent(db, ctx.auth.usuario.id, 'gd_presentation_cancelled', { cluster_id: clusterId })

    return NextResponse.json({ success: true, request: { status: 'cancelled', locked: false } })
  } catch (error) {
    console.error('gd-presentation cancel error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function initiatorClusterWallet(db: any, cluster: any): Promise<string | null> {
  if (!cluster.initiator_church_id) return null
  const row = await db
    .selectFrom('church')
    .select('cluster_wallet')
    .where('id', '=', cluster.initiator_church_id)
    .executeTakeFirst()
  return row?.cluster_wallet ?? null
}


function text(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  const trimmed = String(value ?? '').trim()
  return trimmed ? trimmed : null
}

async function logEvent(db: any, usuarioId: number, eventType: string, eventData: unknown): Promise<void> {
  await db.insertInto('userevent')
    .values({ usuario_id: usuarioId, event_type: eventType, event_data: JSON.stringify(eventData), created_at: new Date() })
    .execute()
}
