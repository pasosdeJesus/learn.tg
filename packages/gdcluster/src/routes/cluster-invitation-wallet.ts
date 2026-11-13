import { NextRequest, NextResponse } from 'next/server'
import {
  getPastorChurch,
  getChurchCluster,
  addClusterHistory,
  notifyUser,
  logUserEvent,
  isType1Country,
} from '../lib/gd-utils.js'
import { churchCompletedCluster } from '../lib/cluster-membership.js'
import type { GdclusterDeps } from '../index.js'

// R-#299: invitación a un clúster por billetera (el código de 6 caracteres ya no existe).
// Sólo el iniciador del clúster invita; el pastor invitado responde Sí/No desde la
// página privada. La misma forma de respuesta (422 `not_invitable` con `reason`) para
// cualquier billetera que no se pueda invitar evita enumerar qué cuentas son pastores
// lead de iglesias verificadas.

export type InvitationReason =
  | 'unknown_wallet'
  | 'not_lead_pastor'
  | 'church_not_verified'
  | 'own_church'
  | 'wrong_country'
  | 'cluster_completed'
  | 'already_in_cluster'
  | 'already_invited'
  | 'invite_limit_reached'

const MESSAGES: Record<InvitationReason, string> = {
  unknown_wallet: 'That wallet is not a pastor of a verified church',
  not_lead_pastor: 'That wallet is not the lead pastor of a church',
  church_not_verified: 'That pastor belongs to a church that is not verified yet',
  own_church: 'You cannot invite yourself',
  wrong_country: 'Clusters are only for pastors of the cluster country, in countries classified as type 1',
  cluster_completed: 'That church belonged to a cluster that already received its funds',
  already_in_cluster: 'That pastor already belongs to a cluster',
  already_invited: 'That pastor is already invited to this cluster',
  invite_limit_reached: 'That pastor already rejected this cluster twice: the invitation is final',
}

function notInvitable(reason: InvitationReason) {
  return NextResponse.json(
    { error: MESSAGES[reason], code: 'not_invitable', reason },
    { status: 422 },
  )
}

/**
 * POST /api/cluster/invitation/wallet
 *
 * Tres formas de invitar, todas del iniciador y con las mismas comprobaciones:
 * - `{ walletAddress, invitedWallet }`: la billetera tecleada (la de R-#299 §3);
 * - `{ walletAddress, usuarioId }`: un pastor de la lista de candidatos (no expone su
 *   billetera);
 * - `{ walletAddress, invitationId }`: reintentar una invitación rechazada (una sola vez,
 *   `invite_count` 1 → 2).
 * `walletAddress` es el iniciador autenticado (pista de sesión): el clúster se deduce de
 * su iglesia.
 */
export async function inviteByWallet(deps: GdclusterDeps, req: NextRequest) {
  try {
    const { walletAddress, invitedWallet, invitationId, usuarioId } = await req.json()

    const invited = typeof invitedWallet === 'string' ? invitedWallet.trim() : ''
    const reinviteOf = invitationId ? Number(invitationId) : null
    const candidateId = usuarioId ? Number(usuarioId) : null
    if (!reinviteOf && !candidateId && !/^0x[0-9a-fA-F]{40}$/.test(invited)) {
      return NextResponse.json(
        { error: 'Enter a valid wallet address (0x followed by 40 hexadecimal characters)', code: 'invalid_wallet' },
        { status: 400 },
      )
    }

    const db = deps.db()
    const auth = await deps.authenticateUser(db, walletAddress)
    if (!auth) return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })

    const church = await getPastorChurch(db, auth.usuario.id)
    if (!church) {
      return NextResponse.json({ error: 'Only the cluster initiator can invite pastors', code: 'not_initiator' }, { status: 403 })
    }

    const membership = await getChurchCluster(db, church.id)
    const cluster = membership
      ? await db.selectFrom('clustergd').selectAll().where('id', '=', membership.clustergd_id).executeTakeFirst()
      : null
    if (!cluster || cluster.initiator_church_id !== church.id) {
      return NextResponse.json({ error: 'Only the cluster initiator can invite pastors', code: 'not_initiator' }, { status: 403 })
    }

    let invitedUser: any = null
    let invitedChurch: any = null
    let existing: any = null
    let invitedAddress = invited || null

    if (reinviteOf) {
      existing = await db
        .selectFrom('cluster_invitation')
        .selectAll()
        .where('id', '=', reinviteOf)
        .executeTakeFirst()
      if (!existing || existing.clustergd_id !== cluster.id) {
        return NextResponse.json({ error: 'Invitation not found', code: 'invitation_not_found' }, { status: 404 })
      }
      invitedAddress = existing.invited_wallet ?? null
      invitedUser = await db.selectFrom('usuario').selectAll().where('id', '=', existing.invited_pastor_id).executeTakeFirst()
      invitedChurch = await db
        .selectFrom('church')
        .select(['id', 'name', 'country_id', 'registration_verified', 'deleted_at'])
        .where('id', '=', existing.invited_church_id)
        .executeTakeFirst()
    } else if (candidateId) {
      invitedUser = await db.selectFrom('usuario').selectAll().where('id', '=', candidateId).executeTakeFirst()
      if (invitedUser) invitedChurch = await getPastorChurch(db, invitedUser.id)
    } else {
      // Billetera → cuenta → usuario. Si no existe se responde igual que cualquier otro
      // caso no invitables (no se revela si la billetera está registrada).
      const walletRow = await db
        .selectFrom('billetera_usuario')
        .select(['usuario_id'])
        .where('billetera', '=', invited.toLowerCase())
        .executeTakeFirst()
      invitedUser = walletRow
        ? await db.selectFrom('usuario').selectAll().where('id', '=', walletRow.usuario_id).executeTakeFirst()
        : null
      invitedChurch = invitedUser ? await getPastorChurch(db, invitedUser.id) : null
    }

    if (!invitedUser) return notInvitable('unknown_wallet')
    if (invitedUser.church_relationship !== 'pastor') return notInvitable('not_lead_pastor')
    if (!invitedChurch || invitedChurch.deleted_at) return notInvitable('not_lead_pastor')
    if (invitedChurch.registration_verified !== true) return notInvitable('church_not_verified')
    if (invitedChurch.id === church.id) return notInvitable('own_church')
    if (invitedChurch.country_id !== cluster.country_id) return notInvitable('wrong_country')
    if (!(await isType1Country(db, invitedChurch.country_id))) return notInvitable('wrong_country')
    if (await churchCompletedCluster(db, invitedChurch.id)) return notInvitable('cluster_completed')
    if (await getChurchCluster(db, invitedChurch.id)) return notInvitable('already_in_cluster')

    // La fila es única por (clúster, pastor): la reinvitación la reabre en vez de
    // insertar otra (R-#299 §4).
    if (!existing) {
      existing = await db
        .selectFrom('cluster_invitation')
        .selectAll()
        .where('clustergd_id', '=', cluster.id)
        .where('invited_pastor_id', '=', invitedUser.id)
        .executeTakeFirst()
    }

    let finalInvitationId: number
    let reinvited = false
    if (existing) {
      if (existing.status === 'pending') return notInvitable('already_invited')
      if (existing.status === 'accepted') return notInvitable('already_in_cluster')
      const inviteCount = Number(existing.invite_count ?? 1)
      if (inviteCount >= 2) return notInvitable('invite_limit_reached')
      finalInvitationId = existing.id
      reinvited = true
      await db
        .updateTable('cluster_invitation')
        .set({
          status: 'pending',
          invite_count: inviteCount + 1,
          responded_at: null,
          response_note: null,
          invited_wallet: invitedAddress,
          origin: 'wallet',
        })
        .where('id', '=', existing.id)
        .execute()
      await addClusterHistory(db, cluster.id, 'invitation_reinvited', invitedChurch.name, invitedChurch.name, auth.usuario.id)
      await logUserEvent(db, auth.usuario.id, 'cluster_invitation_reinvited', {
        cluster_id: cluster.id, invited_usuario_id: invitedUser.id, invited_church_id: invitedChurch.id, wallet: invitedAddress,
      })
    } else {
      const row = await db
        .insertInto('cluster_invitation')
        .values({
          clustergd_id: cluster.id,
          invited_pastor_id: invitedUser.id,
          invited_church_id: invitedChurch.id,
          invited_by_id: auth.usuario.id,
          invited_wallet: invitedAddress,
          origin: 'wallet',
        })
        .returning('id')
        .executeTakeFirstOrThrow()
      finalInvitationId = Number(row.id)
      await addClusterHistory(db, cluster.id, 'invitation_sent', null, invitedChurch.name, auth.usuario.id)
      await logUserEvent(db, auth.usuario.id, 'cluster_invitation_sent', {
        cluster_id: cluster.id, invited_usuario_id: invitedUser.id, invited_church_id: invitedChurch.id, wallet: invitedAddress,
      })
    }

    const link = `/${String(invitedUser.idioma || 'en').startsWith('es') ? 'es' : 'en'}/cluster`
    await notifyUser(
      db, invitedUser.id, 'cluster_invitation',
      'Cluster invitation',
      `You have been invited to join cluster ${cluster.slug} by ${auth.usuario.nombre || auth.usuario.nusuario}. Go to Cluster to accept or reject.`,
      link,
    )

    return NextResponse.json({ success: true, invitationId: finalInvitationId, reinvited })
  } catch (error) {
    console.error('cluster/invitation/wallet error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
