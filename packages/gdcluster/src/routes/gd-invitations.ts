import { NextRequest, NextResponse } from 'next/server'
import {
  getPastorChurch,
  getChurchCluster,
  getClusterMembers,
  addClusterHistory,
  notifyUser,
  logUserEvent,
  getClusterCandidates,
} from '../lib/gd-utils.js'
import { churchCompletedCluster } from '../lib/cluster-membership.js'
import type { GdclusterDeps } from '../index.js'

// Rutas https://github.com/pasosdeJesus/learn.tg/issues/220: estado del pastor, candidatos e invitaciones de clúster.
// La membresía sigue siendo por iglesia (`church_clustergd`); las invitaciones
// se dirigen al pastor (`cluster_invitation`).

/**
 * GET /api/cluster/status — estado del pastor respecto a clústeres.
 * { hasCluster, clusterId, isInitiator, initiator_church_id, cluster, pendingInvitations }
 */
export async function clusterStatus(deps: GdclusterDeps, req: NextRequest) {
  try {
    const walletAddress = req.nextUrl.searchParams.get('walletAddress') || ''
    const db = deps.db()
    const auth = await deps.authenticateUser(db, walletAddress)
    if (!auth) return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })

    const church = await getPastorChurch(db, auth.usuario.id)
    if (!church) return NextResponse.json({ hasCluster: false, noChurch: true, pendingInvitations: [] })

    const membership = await getChurchCluster(db, church.id)

    const pendingInvitations = await db
      .selectFrom('cluster_invitation as ci')
      .innerJoin('clustergd as c', 'c.id', 'ci.clustergd_id')
      .innerJoin('usuario as u', 'u.id', 'ci.invited_by_id')
      .select(['ci.id', 'ci.clustergd_id', 'c.name as cluster_name', 'c.slug', 'u.nombre as inviter_name'])
      .where('ci.invited_pastor_id', '=', auth.usuario.id)
      .where('ci.status', '=', 'pending')
      .execute()

    if (!membership) return NextResponse.json({ hasCluster: false, pendingInvitations })

    const cluster = await db.selectFrom('clustergd').selectAll().where('id', '=', membership.clustergd_id).executeTakeFirst()
    const members = await getClusterMembers(db, membership.clustergd_id)
    const isInitiator = cluster?.initiator_church_id === church.id

    // R-#299 §6: el iniciador ve las invitaciones del clúster con su estado para poder
    // reinvitar una vez tras un rechazo. La membresía sigue siendo por iglesia.
    const invitations = isInitiator
      ? await db
        .selectFrom('cluster_invitation as ci')
        .innerJoin('church as c', 'c.id', 'ci.invited_church_id')
        .select(['ci.id', 'ci.status', 'ci.invite_count', 'ci.origin', 'ci.invited_wallet', 'ci.created_at', 'ci.responded_at', 'c.name as church_name'])
        .where('ci.clustergd_id', '=', membership.clustergd_id)
        .orderBy('ci.created_at', 'asc')
        .execute()
      : []

    return NextResponse.json({
      hasCluster: true,
      clusterId: membership.clustergd_id,
      // Nombre visible del rol: **iniciador del clúster** (no "líder", para no
      // confundirlo con el director de programa ni con el pastor principal de la
      // iglesia). La columna sigue llamándose `initiator_church_id`.
      isInitiator,
      initiator_church_id: cluster?.initiator_church_id ?? null,
      cluster: {
        id: cluster?.id,
        name: cluster?.name,
        slug: cluster?.slug,
        status: cluster?.status,
        member_count: members.length,
        members,
      },
      invitations,
      pendingInvitations,
    })
  } catch (error) {
    console.error('cluster/status error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/cluster/candidates — pastores invitables para formar un clúster
 * (https://github.com/pasosdeJesus/learn.tg/issues/220 §2.1: referidos #163 + referidor si es pastor).
 */
export async function clusterCandidates(deps: GdclusterDeps, req: NextRequest) {
  try {
    const walletAddress = req.nextUrl.searchParams.get('walletAddress') || ''
    const db = deps.db()
    const auth = await deps.authenticateUser(db, walletAddress)
    if (!auth) return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })

    const church = await getPastorChurch(db, auth.usuario.id)
    if (!church) return NextResponse.json({ error: 'Church not found' }, { status: 400 })

    const candidates = await getClusterCandidates(db, auth.usuario.id, church.country_id, church.id)
    return NextResponse.json({
      candidates,
      // R-#299: ya no hay respaldo por código de 6 caracteres: si no hay candidatos, la
      // otra vía es invitar escribiendo la billetera.
      hint: candidates.length < 2 ? 'invite-by-wallet' : null,
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
    const db = deps.db()
    const auth = await deps.authenticateUser(db, walletAddress)
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
    const { walletAddress, invitationId } = await req.json()
    if (!invitationId) return NextResponse.json({ error: 'invitationId is required' }, { status: 400 })

    const db = deps.db()
    const auth = await deps.authenticateUser(db, walletAddress)
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

    const completed = await churchCompletedCluster(db, church.id)
    if (completed) {
      return NextResponse.json(
        {
          error: 'Your church belonged to a cluster that already received its funds and cannot take part in another one',
          code: 'cluster_completed',
        },
        { status: 403 },
      )
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
    await addClusterHistory(db, invitation.clustergd_id, 'invitation_accepted', church.name, church.name, auth.usuario.id)
    await logUserEvent(db, auth.usuario.id, 'cluster_invitation_accepted', {
      cluster_id: invitation.clustergd_id, invitation_id: invitation.id, church_id: church.id,
    })

    const members = await getClusterMembers(db, invitation.clustergd_id)
    const cluster = await db.selectFrom('clustergd').selectAll().where('id', '=', invitation.clustergd_id).executeTakeFirst()
    let activated = false
    if (cluster && members.length >= 3 && cluster.status !== 'active') {
      await db.updateTable('clustergd').set({ status: 'active', updated_at: new Date() }).where('id', '=', cluster.id).execute()
      await addClusterHistory(db, cluster.id, 'status_change', cluster.status, 'active', auth.usuario.id)
      activated = true
      if (cluster.initiator_church_id) {
        const leader = await db.selectFrom('church').select('created_by').where('id', '=', cluster.initiator_church_id).executeTakeFirst()
        if (leader?.created_by) {
          await notifyUser(
            db, leader.created_by, 'cluster_activated',
            'Cluster complete',
            `Your cluster ${cluster.slug} is complete (3 churches)!`,
            `/${auth.usuario.idioma?.startsWith('es') ? 'es' : 'en'}/cluster`
          )
        }
      }
    }

    await notifyUser(
      db, invitation.invited_by_id, 'cluster_invitation_accepted',
      'Invitation accepted',
      `${church.name} joined your cluster ${cluster?.slug}.`,
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
    const { walletAddress, invitationId } = await req.json()
    if (!invitationId) return NextResponse.json({ error: 'invitationId is required' }, { status: 400 })

    const db = deps.db()
    const auth = await deps.authenticateUser(db, walletAddress)
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
    await addClusterHistory(db, invitation.clustergd_id, 'invitation_rejected', null, auth.usuario.nombre || null, auth.usuario.id)
    await logUserEvent(db, auth.usuario.id, 'cluster_invitation_rejected', {
      cluster_id: invitation.clustergd_id, invitation_id: invitation.id, invite_count: invitation.invite_count ?? 1,
    })
    await notifyUser(
      db, invitation.invited_by_id, 'cluster_invitation_rejected',
      'Invitation rejected',
      `${auth.usuario.nombre || 'A pastor'} rejected your invitation to cluster ${cluster?.slug}.`,
      `/${auth.usuario.idioma?.startsWith('es') ? 'es' : 'en'}/cluster`
    )

    // R-#299 §3: sólo se permite una reinvitación a ese mismo pastor (invite_count 1 → 2).
    const inviteCount = Number(invitation.invite_count ?? 1)
    return NextResponse.json({ success: true, can_reinvite: inviteCount < 2 })
  } catch (error) {
    console.error('cluster/invitation/reject error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
