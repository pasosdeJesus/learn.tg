import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'kysely'
import { getChurchCluster, getClusterMembers, addClusterHistory } from '../lib/gd-utils'
import type { GdclusterDeps } from '../index'

// Admin/verificador de clústeres (REQ/220 §5) — sobre los datos existentes
// (`clustergd` + `church_clustergd` + `church`). El auth actual distingue
// solo "verificador" (`authenticateAdmin`); no existe rol admin separado en el
// modelo de auth, así que disolver también está permitido al verificador
// (simplificación documentada; pendiente si se introduce un rol admin real).

type Ctx = { db: any; admin: { usuario_id: number; billetera: string } }

async function requireAdmin(deps: GdclusterDeps, req: NextRequest): Promise<Ctx | null> {
  const walletAddress = req.nextUrl.searchParams.get('wallet') || ''
  const token = req.nextUrl.searchParams.get('token') || ''
  if (!deps.authenticateAdmin || !walletAddress || !token) return null
  const db = deps.db()
  const admin = await deps.authenticateAdmin(db, walletAddress, token)
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
        c.id, c.name, c.pseudonym, c.code, c.country_id, c.status, c.leader_church_id,
        p.nombre AS country_name,
        lc.name AS leader_church_name,
        (SELECT COUNT(*) FROM church_clustergd cc WHERE cc.clustergd_id = c.id AND cc.left_at IS NULL)::int AS member_count,
        lc.cluster_wallet
      FROM clustergd c
      LEFT JOIN msip_pais p ON p.id = c.country_id
      LEFT JOIN church lc ON lc.id = c.leader_church_id
      WHERE 1 = 1
        ${q ? sql`AND (c.name ILIKE ${'%' + q + '%'} OR c.pseudonym ILIKE ${'%' + q + '%'} OR c.code ILIKE ${'%' + q + '%'})` : sql``}
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
    const leader = cluster.leader_church_id
      ? await db.selectFrom('church').selectAll().where('id', '=', cluster.leader_church_id).executeTakeFirst()
      : null

    return NextResponse.json({ cluster: { ...cluster, members, leader_church: leader } })
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

    const { name, pseudonym, leaderChurchId, memberChurchIds = [], countryId, status = 'pending' } = await req.json()
    if (!name || name.length < 3 || name.length > 50) return badRequest('Cluster name must be between 3 and 50 characters')
    if (!leaderChurchId || !countryId) return badRequest('leaderChurchId and countryId are required')

    const existingName = await db.selectFrom('clustergd').select('id')
      .where('name', '=', name).where('country_id', '=', Number(countryId)).executeTakeFirst()
    if (existingName) return NextResponse.json({ error: 'A cluster with this name already exists in your country' }, { status: 409 })

    const cluster = await db.insertInto('clustergd')
      .values({
        name,
        pseudonym: pseudonym?.trim() ? String(pseudonym).trim() : null,
        code: await genCode(db),
        country_id: Number(countryId),
        status: status === 'active' || status === 'disbanded' ? status : 'pending',
        leader_church_id: Number(leaderChurchId),
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    const churchIds = [Number(leaderChurchId), ...memberChurchIds.map((id: any) => Number(id))]
    for (const churchId of new Set(churchIds)) {
      await db.insertInto('church_clustergd')
        .values({ church_id: churchId, clustergd_id: cluster.id })
        .onConflict((oc: any) => oc.columns(['church_id', 'clustergd_id']).doNothing())
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

    const { name, pseudonym, leaderChurchId, status } = await req.json()
    const updates: Record<string, unknown> = { updated_at: new Date() }
    if (name !== undefined) {
      if (!name || name.length < 3 || name.length > 50) return badRequest('Cluster name must be between 3 and 50 characters')
      const dup = await db.selectFrom('clustergd').select('id')
        .where('name', '=', name).where('country_id', '=', cluster.country_id).where('id', '!=', clusterId).executeTakeFirst()
      if (dup) return NextResponse.json({ error: 'A cluster with this name already exists in your country' }, { status: 409 })
      updates.name = name
    }
    if (pseudonym !== undefined) updates.pseudonym = String(pseudonym).trim() ? String(pseudonym).trim() : null
    if (leaderChurchId !== undefined) updates.leader_church_id = Number(leaderChurchId)
    if (status !== undefined) updates.status = status

    await db.updateTable('clustergd').set(updates).where('id', '=', clusterId).execute()
    if (updates.name !== undefined && updates.name !== cluster.name) {
      await addClusterHistory(db, clusterId, 'name_change', cluster.name, updates.name as string, admin.usuario_id)
    }
    if (updates.status !== undefined && updates.status !== cluster.status) {
      await addClusterHistory(db, clusterId, 'status_change', cluster.status, updates.status as string, admin.usuario_id)
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

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

async function genCode(db: any): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = ''
    for (let i = 0; i < 6; i++) code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length))
    const existing = await db.selectFrom('clustergd').select('id').where('code', '=', code).executeTakeFirst()
    if (!existing) return code
  }
  throw new Error('Could not generate unique cluster code after 10 attempts')
}

async function logEvent(db: any, usuarioId: number, eventType: string, eventData: unknown): Promise<void> {
  await db.insertInto('userevent')
    .values({ usuario_id: usuarioId, event_type: eventType, event_data: JSON.stringify(eventData), created_at: new Date() })
    .execute()
}
