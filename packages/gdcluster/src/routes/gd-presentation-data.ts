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
 * PUT /api/cluster/[id]/budget — { walletAddress, firstYearBudget, budgetDraftPath }.
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
    if (body.firstYearBudget !== undefined) {
      const budget = amount(body.firstYearBudget, { max: 1_000_000_000 })
      if (budget === null) return NextResponse.json({ error: 'Invalid first-year budget' }, { status: 400 })
      updates.first_year_budget = budget
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
    return NextResponse.json({
      success: true,
      budget: {
        first_year_budget: updates.first_year_budget ?? ctx.cluster.first_year_budget ?? null,
        budget_draft_path: updates.budget_draft_path ?? ctx.cluster.budget_draft_path ?? null,
      },
    })
  } catch (error) {
    console.error('cluster budget update error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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
    return NextResponse.json({
      success: true,
      director: {
        director_offer_path: updates.director_offer_path ?? ctx.cluster.director_offer_path ?? null,
        director_first_year_pay: updates.director_first_year_pay ?? ctx.cluster.director_first_year_pay ?? null,
        director_first_year_hours: updates.director_first_year_hours ?? ctx.cluster.director_first_year_hours ?? null,
      },
    })
  } catch (error) {
    console.error('cluster director update error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function dateLabel(): string {
  return new Date().toISOString().slice(0, 10)
}
