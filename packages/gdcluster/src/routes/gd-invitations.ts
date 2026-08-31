import { NextRequest, NextResponse } from 'next/server'
import {
  getPastorChurch,
  getChurchCluster,
  getClusterMembers,
  addClusterHistory,
  notifyUser,
  getClusterCandidates,
} from '../lib/gd-utils'
import type { GdclusterDeps } from '../index'

// Rutas REQ/220: estado del pastor, candidatos e invitaciones de clúster.
// La membresía sigue siendo por iglesia (`church_clustergd`); las invitaciones
// se dirigen al pastor (`cluster_invitation`).

/**
 * GET /api/cluster/status — estado del pastor respecto a clústeres.
 * { hasCluster, clusterId, leader, cluster, pendingInvitations }
 */
export async function clusterStatus(deps: GdclusterDeps, req: NextRequest) {
  try {
    const walletAddress = req.nextUrl.searchParams.get('walletAddress') || ''
    const token = req.nextUrl.searchParams.get('token') || ''
    const db = deps.db()
    const auth = await deps.authenticateUser(db, walletAddress, token)
    if (!auth) return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })

    const church = await getPastorChurch(db, auth.usuario.id)
    if (!church) return NextResponse.json({ hasCluster: false, noChurch: true, pendingInvitations: [] })

    const membership = await getChurchCluster(db, church.id)

    const pendingInvitations = await db
      .selectFrom('cluster_invitation as ci')
      .innerJoin('clustergd as c', 'c.id', 'ci.clustergd_id')
      .innerJoin('usuario as u', 'u.id', 'ci.invited_by_id')
      .select(['ci.id', 'ci.clustergd_id', 'c.name as cluster_name', 'c.pseudonym', 'u.nombre as inviter_name'])
      .where('ci.invited_pastor_id', '=', auth.usuario.id)
      .where('ci.status', '=', 'pending')
      .execute()

    if (!membership) return NextResponse.json({ hasCluster: false, pendingInvitations })

    const cluster = await db.selectFrom('clustergd').selectAll().where('id', '=', membership.clustergd_id).executeTakeFirst()
    const members = await getClusterMembers(db, membership.clustergd_id)

    return NextResponse.json({
      hasCluster: true,
      clusterId: membership.clustergd_id,
      leader: cluster?.leader_church_id === church.id,
      cluster: {
        id: cluster?.id,
        name: cluster?.name,
        pseudonym: cluster?.pseudonym,
        code: cluster?.code,
        status: cluster?.status,
        member_count: members.length,
        members,
      },
      pendingInvitations,
    })
  } catch (error) {
    console.error('cluster/status error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/cluster/candidates — pastores invitables para formar un clúster
 * (REQ/220 §2.1: referidos #163 + referidor si es pastor).
 */
export async function clusterCandidates(deps: GdclusterDeps, req: NextRequest) {
  try {
    const walletAddress = req.nextUrl.searchParams.get('walletAddress') || ''
    const token = req.nextUrl.searchParams.get('token') || ''
    const db = deps.db()
    const auth = await deps.authenticateUser(db, walletAddress, token)
    if (!auth) return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })

    const church = await getPastorChurch(db, auth.usuario.id)
    if (!church) return NextResponse.json({ error: 'Church not found' }, { status: 400 })

    const candidates = await getClusterCandidates(db, auth.usuario.id, church.country_id, church.id)
    return NextResponse.json({
      candidates,
      fallback: candidates.length < 2,
      // Fallback: código de 6 chars del clúster (ruta existente /api/cluster/join)
      hint: candidates.length < 2 ? 'invite-by-code' : null,
    })
  } catch (error) {
    console.error('cluster/candidates error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/cluster/invitations — invitaciones pendientes del pastor.
 */
export async function listInvitations(deps: GdclusterDeps, req: NextRequest) {
  try {
    const walletAddress = req.nextUrl.searchParams.get('walletAddress') || ''
    const token = req.nextUrl.searchParams.get('token') || ''
    const db = deps.db()
    const auth = await deps.authenticateUser(db, walletAddress, token)
    if (!auth) return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })

    const invitations = await db
      .selectFrom('cluster_invitation as ci')
      .innerJoin('clustergd as c', 'c.id', 'ci.clustergd_id')
      .innerJoin('usuario as u', 'u.id', 'ci.invited_by_id')
      .select(['ci.id', 'ci.clustergd_id', 'c.name as cluster_name', 'u.nombre as inviter_name', 'ci.created_at'])
      .where('ci.invited_pastor_id', '=', auth.usuario.id)
      .where('ci.status', '=', 'pending')
      .execute()

    return NextResponse.json({ invitations })
  } catch (error) {
    console.error('cluster/invitations error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/cluster/invitation/accept — aceptar invitación: la iglesia del
 * pastor entra a `church_clustergd`; con 3 miembros el clúster pasa a `active`.
 */
export async function acceptInvitation(deps: GdclusterDeps, req: NextRequest) {
  try {
    const { walletAddress, token, invitationId } = await req.json()
    if (!invitationId) return NextResponse.json({ error: 'invitationId is required' }, { status: 400 })

    const db = deps.db()
    const auth = await deps.authenticateUser(db, walletAddress, token)
    if (!auth) return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })

    const church = await getPastorChurch(db, auth.usuario.id)
    if (!church) return NextResponse.json({ error: 'Church not found' }, { status: 400 })

    const invitation = await db
      .selectFrom('cluster_invitation')
      .selectAll()
      .where('id', '=', Number(invitationId))
      .executeTakeFirst()
    if (!invitation) return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    if (invitation.invited_pastor_id !== auth.usuario.id) {
      return NextResponse.json({ error: 'Invitation not addressed to you' }, { status: 403 })
    }
    if (invitation.invited_church_id !== church.id) {
      return NextResponse.json({ error: 'Invitation does not match your church' }, { status: 403 })
    }
    if (invitation.status !== 'pending') {
      return NextResponse.json({ error: 'Invitation already responded' }, { status: 400 })
    }

    const existingMembership = await getChurchCluster(db, church.id)
    if (existingMembership) {
      return NextResponse.json({ error: 'Your church already belongs to a cluster' }, { status: 409 })
    }

    await db.updateTable('cluster_invitation')
      .set({ status: 'accepted', responded_at: new Date() })
      .where('id', '=', invitation.id)
      .execute()

    await db.insertInto('church_clustergd')
      .values({ church_id: church.id, clustergd_id: invitation.clustergd_id })
      .execute()

    await addClusterHistory(db, invitation.clustergd_id, 'church_join', null, church.name, auth.usuario.id)

    const members = await getClusterMembers(db, invitation.clustergd_id)
    const cluster = await db.selectFrom('clustergd').selectAll().where('id', '=', invitation.clustergd_id).executeTakeFirst()
    let activated = false
    if (cluster && members.length >= 3 && cluster.status !== 'active') {
      await db.updateTable('clustergd').set({ status: 'active', updated_at: new Date() }).where('id', '=', cluster.id).execute()
      await addClusterHistory(db, cluster.id, 'status_change', cluster.status, 'active', auth.usuario.id)
      activated = true
      if (cluster.leader_church_id) {
        const leader = await db.selectFrom('church').select('created_by').where('id', '=', cluster.leader_church_id).executeTakeFirst()
        if (leader?.created_by) {
          await notifyUser(
            db, leader.created_by, 'cluster_activated',
            'Cluster complete',
            `Your cluster ${cluster.pseudonym || cluster.name} is complete (3 churches)!`,
            `/${auth.usuario.idioma?.startsWith('es') ? 'es' : 'en'}/cluster`
          )
        }
      }
    }

    await notifyUser(
      db, invitation.invited_by_id, 'cluster_invitation_accepted',
      'Invitation accepted',
      `${church.name} joined your cluster ${cluster?.pseudonym || cluster?.name}.`,
      `/${auth.usuario.idioma?.startsWith('es') ? 'es' : 'en'}/cluster`
    )

    return NextResponse.json({ success: true, activated, member_count: members.length })
  } catch (error) {
    console.error('cluster/invitation/accept error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/cluster/invitation/reject — rechazar invitación.
 */
export async function rejectInvitation(deps: GdclusterDeps, req: NextRequest) {
  try {
    const { walletAddress, token, invitationId } = await req.json()
    if (!invitationId) return NextResponse.json({ error: 'invitationId is required' }, { status: 400 })

    const db = deps.db()
    const auth = await deps.authenticateUser(db, walletAddress, token)
    if (!auth) return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })

    const invitation = await db
      .selectFrom('cluster_invitation')
      .selectAll()
      .where('id', '=', Number(invitationId))
      .executeTakeFirst()
    if (!invitation) return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    if (invitation.invited_pastor_id !== auth.usuario.id) {
      return NextResponse.json({ error: 'Invitation not addressed to you' }, { status: 403 })
    }
    if (invitation.status !== 'pending') {
      return NextResponse.json({ error: 'Invitation already responded' }, { status: 400 })
    }

    await db.updateTable('cluster_invitation')
      .set({ status: 'rejected', responded_at: new Date() })
      .where('id', '=', invitation.id)
      .execute()

    const cluster = await db.selectFrom('clustergd').selectAll().where('id', '=', invitation.clustergd_id).executeTakeFirst()
    await notifyUser(
      db, invitation.invited_by_id, 'cluster_invitation_rejected',
      'Invitation rejected',
      `${auth.usuario.nombre || 'A pastor'} rejected your invitation to cluster ${cluster?.pseudonym || cluster?.name}.`,
      `/${auth.usuario.idioma?.startsWith('es') ? 'es' : 'en'}/cluster`
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('cluster/invitation/reject error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
