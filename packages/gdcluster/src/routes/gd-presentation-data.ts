import { NextRequest, NextResponse } from 'next/server'
import { getPastorChurch, addClusterHistory } from '../lib/gd-utils.js'
import { presentationFieldsLocked } from '../lib/gd-presentation.js'
import type { GdclusterDeps } from '../index.js'

// Datos que se fijan al solicitar la presentación a Global Disciples
// (https://github.com/pasosdeJesus/learn.tg/issues/161): el presupuesto del primer año
// (PDF + total) y la oferta del director (PDF + pago total + horas esperadas).
// Los edita el iniciador del clúster mientras el estado de la presentación no los
// bloquee (`presentationFieldsLocked`); el PDF lo sube `/api/cluster/[id]/document`.

const PDF_PATH_PATTERN = /^cluster\/\d+\/(budget|director)\.pdf$/

// El estado acompaña el avance de los datos (REQ/161 §4.7): con la billetera aprobada el
// clúster espera el presupuesto (`waiting_for_budget`) y, cuando el presupuesto está
// completo, la oferta del director (`waiting_for_pd_job_offer`). Un cambio de datos en
// `returned` devuelve el clúster a la espera y caduca las aprobaciones de la fase `data`
// (el hash se recalcula al leer, así que caducan solas).
const DATA_STATES = ['wallet_approved', 'waiting_for_budget', 'waiting_for_pd_job_offer', 'returned']

async function syncDataState(
  db: any,
  clusterId: number,
  before: any,
  after: any,
  usuarioId: number,
): Promise<string | null> {
  const status = String(before.gd_status ?? 'forming')
  if (!DATA_STATES.includes(status)) return null
  const budgetReady = Number(after.fourth_year_budget ?? 0) > 0 && !!after.budget_draft_path
  const next = budgetReady ? 'waiting_for_pd_job_offer' : 'waiting_for_budget'
  if (next === status) return null
  try {
    await db
    .updateTable('clustergd')
    .set({ gd_status: next, updated_at: new Date() })
    .where('id', '=', clusterId)
      .where('gd_status', '=', status)
      .execute()
    await addClusterHistory(db, clusterId, 'gd_status_changed', status, next, usuarioId)
  } catch (error) {
    // Los datos ya quedaron guardados: un fallo al mover el estado se registra y se
    // sigue (la siguiente lectura lo vuelve a intentar con los datos completos).
    const message = error instanceof Error ? error.message : String(error)
    console.error('gd data state sync failed:', message)
    return message
  }
  return null
}

interface Context {
  db: any
  cluster: any
  usuarioId: number
  body: any
}

async function initiatorContext(
  deps: GdclusterDeps,
  req: NextRequest,
  params: Record<string, string>,
): Promise<Context | { error: NextResponse }> {
  const clusterId = parseInt(params?.id ?? '', 10)
  if (Number.isNaN(clusterId) || clusterId < 1) {
    return { error: NextResponse.json({ error: 'Invalid cluster ID' }, { status: 400 }) }
  }
  const db = deps.db()
  const body = await req.json().catch(() => ({}))
  const auth = await deps.authenticateUser(db, body.walletAddress)
  if (!auth) return { error: NextResponse.json({ error: 'Authentication failed' }, { status: 401 }) }

  const cluster = await db.selectFrom('clustergd').selectAll().where('id', '=', clusterId).executeTakeFirst()
  if (!cluster) return { error: NextResponse.json({ error: 'Cluster not found' }, { status: 404 }) }

  const church = await getPastorChurch(db, auth.usuario.id)
  if (!church || cluster.initiator_church_id !== church.id) {
    return { error: NextResponse.json({ error: 'Only the cluster initiator can edit these data' }, { status: 403 }) }
  }
  if (presentationFieldsLocked(cluster.gd_status)) {
    return {
      error: NextResponse.json(
        { error: 'The presentation was requested: the budget and the director offer are fixed', code: 'gd_fields_locked' },
        { status: 409 },
      ),
    }
  }
  return { db, cluster, usuarioId: auth.usuario.id, body }
}

function amount(value: unknown, { max }: { max: number }): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > max) return null
  return Math.round(parsed * 100) / 100
}

/**
 * PUT /api/cluster/[id]/budget — { walletAddress, fourthYearBudget, budgetDraftPath }.
 * Ambos campos se guardan juntos: el total sin el PDF (o al revés) no basta para
 * solicitar la presentación y el error lo dice (`missing_data`).
 */
export async function updateBudget(deps: GdclusterDeps, req: NextRequest, params: Record<string, string>) {
  const clusterId = parseInt(params?.id ?? '', 10)
  try {
    const ctx = await initiatorContext(deps, req, params)
    if ('error' in ctx) return ctx.error
    const body = ctx.body ?? {}

    const updates: Record<string, unknown> = { updated_at: new Date() }
    if (body.fourthYearBudget !== undefined) {
      const budget = amount(body.fourthYearBudget, { max: 1_000_000_000 })
      if (budget === null) return NextResponse.json({ error: 'Invalid first-year budget' }, { status: 400 })
      updates.fourth_year_budget = budget
    }
    if (body.budgetDraftPath !== undefined) {
      const path = String(body.budgetDraftPath ?? '').trim()
      if (path && !PDF_PATH_PATTERN.test(path)) {
        return NextResponse.json({ error: 'Invalid budget document path' }, { status: 400 })
      }
      updates.budget_draft_path = path || null
    }

    await ctx.db.updateTable('clustergd').set(updates).where('id', '=', clusterId).execute()
    await addClusterHistory(ctx.db, clusterId, 'budget_updated', null, dateLabel(), ctx.usuarioId)
    const stateError = await syncDataState(ctx.db, clusterId, ctx.cluster, { ...ctx.cluster, ...updates }, ctx.usuarioId)
    const after = await ctx.db.selectFrom('clustergd').select('gd_status').where('id', '=', clusterId).executeTakeFirst()
    return NextResponse.json({
      success: true,
      gd_status: after?.gd_status ?? null,
      ...(stateError ? { state_sync_error: stateError } : {}),
      budget: {
        fourth_year_budget: updates.fourth_year_budget ?? ctx.cluster.fourth_year_budget ?? null,
        budget_draft_path: updates.budget_draft_path ?? ctx.cluster.budget_draft_path ?? null,
      },
    })
  } catch (error) {
    console.error('cluster budget update error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json(
      { error: 'Internal server error', code: 'budget_update_failed', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

/**
 * PUT /api/cluster/[id]/director — { walletAddress, directorOfferPath,
 * directorFirstYearPay, directorFirstYearHours }.
 */
export async function updateDirector(deps: GdclusterDeps, req: NextRequest, params: Record<string, string>) {
  const clusterId = parseInt(params?.id ?? '', 10)
  try {
    const ctx = await initiatorContext(deps, req, params)
    if ('error' in ctx) return ctx.error
    const body = ctx.body ?? {}

    const updates: Record<string, unknown> = { updated_at: new Date() }
    if (body.directorFirstYearPay !== undefined) {
      const pay = amount(body.directorFirstYearPay, { max: 1_000_000_000 })
      if (pay === null) return NextResponse.json({ error: 'Invalid director first-year pay' }, { status: 400 })
      updates.director_first_year_pay = pay
    }
    if (body.directorFirstYearHours !== undefined) {
      const hours = amount(body.directorFirstYearHours, { max: 100_000 })
      if (hours === null) return NextResponse.json({ error: 'Invalid director first-year hours' }, { status: 400 })
      updates.director_first_year_hours = hours
    }
    if (body.directorOfferPath !== undefined) {
      const path = String(body.directorOfferPath ?? '').trim()
      if (path && !PDF_PATH_PATTERN.test(path)) {
        return NextResponse.json({ error: 'Invalid director document path' }, { status: 400 })
      }
      updates.director_offer_path = path || null
    }

    await ctx.db.updateTable('clustergd').set(updates).where('id', '=', clusterId).execute()
    await addClusterHistory(ctx.db, clusterId, 'director_updated', null, dateLabel(), ctx.usuarioId)
    const stateError = await syncDataState(ctx.db, clusterId, ctx.cluster, { ...ctx.cluster, ...updates }, ctx.usuarioId)
    const after = await ctx.db.selectFrom('clustergd').select('gd_status').where('id', '=', clusterId).executeTakeFirst()
    return NextResponse.json({
      success: true,
      gd_status: after?.gd_status ?? null,
      ...(stateError ? { state_sync_error: stateError } : {}),
      director: {
        director_offer_path: updates.director_offer_path ?? ctx.cluster.director_offer_path ?? null,
        director_first_year_pay: updates.director_first_year_pay ?? ctx.cluster.director_first_year_pay ?? null,
        director_first_year_hours: updates.director_first_year_hours ?? ctx.cluster.director_first_year_hours ?? null,
      },
    })
  } catch (error) {
    console.error('cluster director update error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json(
      { error: 'Internal server error', code: 'director_update_failed', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

function dateLabel(): string {
  return new Date().toISOString().slice(0, 10)
}
