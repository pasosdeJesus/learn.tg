import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'kysely'
import { getChurchCluster, getClusterMembers, addClusterHistory, notifyUser } from '../lib/gd-utils.js'
import { suggestSlug, slugWithId, validateSlug } from '../lib/slug.js'
import type { GdclusterDeps } from '../index.js'

// Admin/verificador de clústeres (https://github.com/pasosdeJesus/learn.tg/issues/220 §5) — sobre los datos existentes
// (`clustergd` + `church_clustergd` + `church`). El auth actual distingue
// solo "verificador" (`authenticateAdmin`); no existe rol admin separado en el
// modelo de auth, así que disolver también está permitido al verificador
// (simplificación documentada; pendiente si se introduce un rol admin real).

type Ctx = { db: any; admin: { usuario_id: number; billetera: string } }

async function requireAdmin(deps: GdclusterDeps, req: NextRequest): Promise<Ctx | null> {
  const walletAddress = req.nextUrl.searchParams.get('wallet') || ''
  if (!deps.authenticateAdmin || !walletAddress) return null
  const db = deps.db()
  const admin = await deps.authenticateAdmin(db, walletAddress)
  if (!admin) return null
  return { db, admin }
}

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 })
}

/** GET /api/admin/clusters?q=&country=&status= */
export async function adminListClusters(deps: GdclusterDeps, req: NextRequest) {
  try {
    const ctx = await requireAdmin(deps, req)
    if (!ctx) return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    const { db } = ctx

    const q = (req.nextUrl.searchParams.get('q') || '').trim()
    const country = req.nextUrl.searchParams.get('country') || ''
    const status = req.nextUrl.searchParams.get('status') || ''

    const rows = await sql<any>`
      SELECT
        c.id, c.name, c.slug, c.country_id, c.status, c.initiator_church_id,
        c.gd_status, c.gd_requested_at, c.gd_sent_at, c.gd_response, c.gd_contact_email,
        c.gd_evaluation, c.gd_suggestions,
        p.nombre AS country_name,
        lc.name AS initiator_church_name,
        (SELECT COUNT(*) FROM church_clustergd cc WHERE cc.clustergd_id = c.id AND cc.left_at IS NULL)::int AS member_count,
        lc.cluster_wallet
      FROM clustergd c
      LEFT JOIN msip_pais p ON p.id = c.country_id
      LEFT JOIN church lc ON lc.id = c.initiator_church_id
      WHERE 1 = 1
        ${q ? sql`AND (c.name ILIKE ${'%' + q + '%'} OR c.slug ILIKE ${'%' + q + '%'})` : sql``}
        ${country ? sql`AND c.country_id = ${Number(country)}` : sql``}
        ${status ? sql`AND c.status = ${status}` : sql``}
      ORDER BY c.id DESC
    `.execute(db)

    return NextResponse.json({ clusters: rows.rows })
  } catch (error) {
    console.error('admin/clusters list error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** GET /api/admin/clusters/[id] */
export async function adminGetCluster(deps: GdclusterDeps, req: NextRequest, params: Record<string, string>) {
  try {
    const ctx = await requireAdmin(deps, req)
    if (!ctx) return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    const { db } = ctx
    const clusterId = parseInt(params?.id ?? '', 10)
    if (isNaN(clusterId)) return badRequest('Invalid cluster ID')

    const cluster = await db.selectFrom('clustergd').selectAll().where('id', '=', clusterId).executeTakeFirst()
    if (!cluster) return NextResponse.json({ error: 'Cluster not found' }, { status: 404 })

    const members = await getClusterMembers(db, clusterId)
    const initiatorChurch = cluster.initiator_church_id
      ? await db.selectFrom('church').selectAll().where('id', '=', cluster.initiator_church_id).executeTakeFirst()
      : null

    return NextResponse.json({ cluster: { ...cluster, members, initiator_church: initiatorChurch } })
  } catch (error) {
    console.error('admin/clusters get error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** POST /api/admin/clusters — crear clúster manualmente */
export async function adminCreateCluster(deps: GdclusterDeps, req: NextRequest) {
  try {
    const ctx = await requireAdmin(deps, req)
    if (!ctx) return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    const { db, admin } = ctx

    const { name, slug, initiatorChurchId, memberChurchIds = [], countryId, status = 'pending' } = await req.json()
    const clusterName = typeof name === 'string' ? name.trim() : ''
    if (clusterName.length < 3 || clusterName.length > 50) return badRequest('Cluster name must be between 3 and 50 characters')
    if (!initiatorChurchId || !countryId) return badRequest('initiatorChurchId and countryId are required')

    // R-#299: `name` y `slug` son únicos en todo learn.tg y la comparación ignora
    // mayúsculas y espacios (los índices únicos son la verdad).
    const existingName = await db.selectFrom('clustergd').select('id')
      .where(sql<boolean>`lower(btrim(name)) = lower(btrim(${clusterName}))`).executeTakeFirst()
    if (existingName) return NextResponse.json({ error: 'A cluster with this name already exists', code: 'name_taken' }, { status: 409 })

    let requestedSlug: string | null = null
    if (slug !== undefined && slug !== null && String(slug).trim() !== '') {
      const checked = validateSlug(String(slug).trim().toLowerCase())
      if (!checked.ok) return NextResponse.json({ error: 'The alias must have 2 to 40 characters: lowercase letters, digits and single hyphens', code: 'slug_invalid' }, { status: 400 })
      requestedSlug = checked.slug
      const taken = await db.selectFrom('clustergd').select('id').where('slug', '=', requestedSlug).executeTakeFirst()
      if (taken) return NextResponse.json({ error: `The alias "${requestedSlug}" is already in use`, code: 'slug_taken' }, { status: 409 })
    }

    const derived = suggestSlug(clusterName)
    const baseSlug = validateSlug(derived).ok ? derived : 'cl'

    const cluster = await db.transaction().execute(async (trx: any) => {
      const row = await trx.insertInto('clustergd')
        .values({
          name: clusterName,
          slug: requestedSlug ?? `cl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
          country_id: Number(countryId),
          status: status === 'active' || status === 'disbanded' ? status : 'pending',
          initiator_church_id: Number(initiatorChurchId),
        })
        .returningAll()
        .executeTakeFirstOrThrow()
      if (requestedSlug) return row
      let finalSlug = baseSlug
      const taken = await trx.selectFrom('clustergd').select('id').where('slug', '=', finalSlug).executeTakeFirst()
      if (taken) finalSlug = slugWithId(baseSlug, row.id)
      await trx.updateTable('clustergd').set({ slug: finalSlug }).where('id', '=', row.id).execute()
      return { ...row, slug: finalSlug }
    })

    const churchIds = [Number(initiatorChurchId), ...memberChurchIds.map((id: any) => Number(id))]
    for (const churchId of new Set(churchIds)) {
      // church_clustergd no tiene constraint único (church_id, clustergd_id):
      // insert directo; el handler ya valida que las iglesias no estén en otro
      // clúster en adminAddMember, aquí se confía en el admin.
      await db.insertInto('church_clustergd')
        .values({ church_id: churchId, clustergd_id: cluster.id })
        .execute()
    }

    await addClusterHistory(db, cluster.id, 'admin_create', null, name, admin.usuario_id)
    await logEvent(db, admin.usuario_id, 'admin_cluster_created', { cluster_id: cluster.id, name })

    return NextResponse.json({ cluster }, { status: 201 })
  } catch (error) {
    console.error('admin/clusters create error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** PUT /api/admin/clusters/[id] */
export async function adminUpdateCluster(deps: GdclusterDeps, req: NextRequest, params: Record<string, string>) {
  try {
    const ctx = await requireAdmin(deps, req)
    if (!ctx) return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    const { db, admin } = ctx
    const clusterId = parseInt(params?.id ?? '', 10)
    if (isNaN(clusterId)) return badRequest('Invalid cluster ID')

    const cluster = await db.selectFrom('clustergd').selectAll().where('id', '=', clusterId).executeTakeFirst()
    if (!cluster) return NextResponse.json({ error: 'Cluster not found' }, { status: 404 })

    const { name, slug, initiatorChurchId, status, gdSent, gdResponse, gdContactEmail } = await req.json()
    const updates: Record<string, unknown> = { updated_at: new Date() }
    if (name !== undefined) {
      const clusterName = typeof name === 'string' ? name.trim() : ''
      if (clusterName.length < 3 || clusterName.length > 50) return badRequest('Cluster name must be between 3 and 50 characters')
      const dup = await db.selectFrom('clustergd').select('id')
        .where(sql<boolean>`lower(btrim(name)) = lower(btrim(${clusterName}))`).where('id', '!=', clusterId).executeTakeFirst()
      if (dup) return NextResponse.json({ error: 'A cluster with this name already exists', code: 'name_taken' }, { status: 409 })
      updates.name = clusterName
    }
    // R-#299: el alias (slug) también lo edita el verificador; nunca se recalcula solo.
    if (slug !== undefined) {
      const checked = validateSlug(String(slug ?? '').trim().toLowerCase())
      if (!checked.ok) return NextResponse.json({ error: 'The alias must have 2 to 40 characters: lowercase letters, digits and single hyphens', code: 'slug_invalid' }, { status: 400 })
      if (checked.slug !== cluster.slug) {
        const dup = await db.selectFrom('clustergd').select('id')
          .where('slug', '=', checked.slug).where('id', '!=', clusterId).executeTakeFirst()
        if (dup) return NextResponse.json({ error: `The alias "${checked.slug}" is already in use`, code: 'slug_taken', suggestion: slugWithId(checked.slug, clusterId) }, { status: 409 })
      }
      updates.slug = checked.slug
    }
    if (initiatorChurchId !== undefined) updates.initiator_church_id = Number(initiatorChurchId)
    if (status !== undefined) updates.status = status

    // Presentación a Global Disciples (R-#161): pdJ marca el envío del correo y registra
    // la respuesta y el correo/canal que GD indique. Solo sobre un clúster que ya pidió
    // la presentación.
    const touchesGd = gdSent !== undefined || gdResponse !== undefined || gdContactEmail !== undefined
    if (touchesGd && !cluster.gd_requested_at) {
      return badRequest('The cluster has not requested the presentation to Global Disciples')
    }
    if (gdSent === true && !cluster.gd_sent_at) {
      updates.gd_sent_at = new Date()
      updates.gd_sent_by = admin.usuario_id
    }
    if (gdContactEmail !== undefined) {
      const email = String(gdContactEmail ?? '').trim()
      updates.gd_contact_email = email ? email : null
    }
    if (gdResponse !== undefined) {
      const text = String(gdResponse ?? '').trim()
      updates.gd_response = text ? text : null
      updates.gd_response_at = new Date()
      updates.gd_response_by = admin.usuario_id
    }

    await db.updateTable('clustergd').set(updates).where('id', '=', clusterId).execute()
    if (updates.name !== undefined && updates.name !== cluster.name) {
      await addClusterHistory(db, clusterId, 'name_change', cluster.name, updates.name as string, admin.usuario_id)
    }
    if (updates.slug !== undefined && updates.slug !== cluster.slug) {
      await addClusterHistory(db, clusterId, 'slug_change', cluster.slug, updates.slug as string, admin.usuario_id)
    }
    if (updates.status !== undefined && updates.status !== cluster.status) {
      await addClusterHistory(db, clusterId, 'status_change', cluster.status, updates.status as string, admin.usuario_id)
    }
    if (gdSent === true && !cluster.gd_sent_at) {
      await addClusterHistory(db, clusterId, 'gd_presentation_sent', null, 'sent', admin.usuario_id)
      await logEvent(db, admin.usuario_id, 'gd_presentation_sent', { cluster_id: clusterId })
    }
    if (gdResponse !== undefined) {
      await addClusterHistory(db, clusterId, 'gd_presentation_response', cluster.gd_response ?? null, updates.gd_response as string | null, admin.usuario_id)
      await logEvent(db, admin.usuario_id, 'gd_presentation_response', { cluster_id: clusterId })
      const initiator = cluster.initiator_church_id
        ? await db
            .selectFrom('church as c')
            .innerJoin('usuario as u', 'u.church_id', 'c.id')
            .select(['u.id as usuario_id', 'u.idioma as idioma'])
            .where('c.id', '=', cluster.initiator_church_id)
            .where('u.church_relationship', '=', 'pastor')
            .executeTakeFirst()
        : null
      if (initiator?.usuario_id) {
        const es = String(initiator.idioma || 'en').startsWith('es')
        await notifyUser(
          db,
          Number(initiator.usuario_id),
          'gd_presentation',
          es ? 'Global Disciples respondió' : 'Global Disciples answered',
          es
            ? 'La página del clúster tiene la respuesta y el correo o canal para continuar directamente con Global Disciples.'
            : 'The cluster page has the answer and the email or channel to continue directly with Global Disciples.',
          `/${es ? 'es' : 'en'}/cluster`,
        )
      }
    }
    await logEvent(db, admin.usuario_id, 'admin_cluster_updated', { cluster_id: clusterId, updates })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('admin/clusters update error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** DELETE /api/admin/clusters/[id] — disolución soft */
export async function adminDisbandCluster(deps: GdclusterDeps, req: NextRequest, params: Record<string, string>) {
  try {
    const ctx = await requireAdmin(deps, req)
    if (!ctx) return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    const { db, admin } = ctx
    const clusterId = parseInt(params?.id ?? '', 10)
    if (isNaN(clusterId)) return badRequest('Invalid cluster ID')

    const cluster = await db.selectFrom('clustergd').selectAll().where('id', '=', clusterId).executeTakeFirst()
    if (!cluster) return NextResponse.json({ error: 'Cluster not found' }, { status: 404 })

    await db.updateTable('clustergd').set({ status: 'disbanded', updated_at: new Date() }).where('id', '=', clusterId).execute()
    await addClusterHistory(db, clusterId, 'status_change', cluster.status, 'disbanded', admin.usuario_id)
    await logEvent(db, admin.usuario_id, 'admin_cluster_disbanded', { cluster_id: clusterId })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('admin/clusters disband error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** POST /api/admin/clusters/[id]/members — añadir iglesia miembro */
export async function adminAddMember(deps: GdclusterDeps, req: NextRequest, params: Record<string, string>) {
  try {
    const ctx = await requireAdmin(deps, req)
    if (!ctx) return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    const { db, admin } = ctx
    const clusterId = parseInt(params?.id ?? '', 10)
    if (isNaN(clusterId)) return badRequest('Invalid cluster ID')

    const { churchId } = await req.json()
    if (!churchId) return badRequest('churchId is required')

    const existing = await getChurchCluster(db, Number(churchId))
    if (existing) return NextResponse.json({ error: 'Church already belongs to a cluster' }, { status: 409 })

    await db.insertInto('church_clustergd')
      .values({ church_id: Number(churchId), clustergd_id: clusterId })
      .execute()
    await addClusterHistory(db, clusterId, 'admin_member_add', null, String(churchId), admin.usuario_id)
    await logEvent(db, admin.usuario_id, 'admin_cluster_member_add', { cluster_id: clusterId, church_id: Number(churchId) })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('admin/clusters member add error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** DELETE /api/admin/clusters/[id]/members?churchId= — remover iglesia miembro */
export async function adminRemoveMember(deps: GdclusterDeps, req: NextRequest, params: Record<string, string>) {
  try {
    const ctx = await requireAdmin(deps, req)
    if (!ctx) return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    const { db, admin } = ctx
    const clusterId = parseInt(params?.id ?? '', 10)
    if (isNaN(clusterId)) return badRequest('Invalid cluster ID')
    const churchId = Number(req.nextUrl.searchParams.get('churchId') || '')
    if (!churchId) return badRequest('churchId is required')

    await db.updateTable('church_clustergd')
      .set({ left_at: new Date() })
      .where('church_id', '=', churchId)
      .where('clustergd_id', '=', clusterId)
      .where('left_at', 'is', null)
      .execute()
    await addClusterHistory(db, clusterId, 'admin_member_remove', null, String(churchId), admin.usuario_id)
    await logEvent(db, admin.usuario_id, 'admin_cluster_member_remove', { cluster_id: clusterId, church_id: churchId })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('admin/clusters member remove error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── helpers ────────────────────────────────────────────────────────────────

async function logEvent(db: any, usuarioId: number, eventType: string, eventData: unknown): Promise<void> {
  await db.insertInto('userevent')
    .values({ usuario_id: usuarioId, event_type: eventType, event_data: JSON.stringify(eventData), created_at: new Date() })
    .execute()
}
