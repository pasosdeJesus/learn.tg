import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { apiDbMocks } from '@pasosdejesus/m/test-utils/kysely-mocks'

import { acceptInvitation, rejectInvitation, clusterStatus } from '../gd-invitations'
import type { GdclusterDeps } from '../../index'

const { mockExecuteTakeFirst, mockExecute, setupMocks, resetMocks, setupCommonResponses } = apiDbMocks

const WALLET = '0x1234567890123456789012345678901234567890'
const TOKEN = 'token'

function buildDeps(overrides: Record<string, any> = {}): any {
  return {
    db: () => new apiDbMocks.MockKysely(),
    authenticateUser: vi.fn().mockResolvedValue({
      usuario: { id: 5, church_id: 20, idioma: 'es_CO', nombre: 'Pastor B', church_relationship: 'pastor' },
      billetera: { billetera: WALLET },
    }),
    backend: {},
    ...overrides,
  }
}

function post(url: string, body: any): NextRequest {
  return new NextRequest(`http://localhost${url}`, { method: 'POST', body: JSON.stringify(body) })
}

describe('clusterStatus (https://github.com/pasosdeJesus/learn.tg/issues/220)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
    setupCommonResponses()
  })

  it('returns pending invitations and no cluster when the pastor is not a member', async () => {
    // getPastorChurch → church; getChurchCluster → null; invitations query → 1
    mockExecuteTakeFirst
      .mockResolvedValueOnce({ id: 20, name: 'Iglesia B', country_id: 694 })
      .mockResolvedValueOnce(null)
    mockExecute.mockResolvedValue([
      { id: 1, clustergd_id: 3, cluster_name: 'Esperanza', pseudonym: null, inviter_name: 'Pastor A' },
    ])
    const res = await clusterStatus(buildDeps() as GdclusterDeps, post('/api/cluster/status', { walletAddress: WALLET, token: TOKEN }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.hasCluster).toBe(false)
    expect(json.pendingInvitations).toHaveLength(1)
    expect(json.pendingInvitations[0].cluster_name).toBe('Esperanza')
  })

  it('returns cluster details when the church is a member', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce({ id: 20, name: 'Iglesia B', country_id: 694 }) // church
      .mockResolvedValueOnce({ clustergd_id: 3, joined_at: new Date(), left_at: null }) // membership
      .mockResolvedValueOnce({ id: 3, name: 'Esperanza', pseudonym: null, code: 'ABC123', status: 'pending', leader_church_id: 20 })
    mockExecute.mockResolvedValue([
      { church_id: 20, church_name: 'Iglesia B', joined_at: new Date() },
    ])
    const res = await clusterStatus(buildDeps() as GdclusterDeps, post('/api/cluster/status', { walletAddress: WALLET, token: TOKEN }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.hasCluster).toBe(true)
    expect(json.leader).toBe(true) // leader_church_id === church.id
    expect(json.cluster.member_count).toBe(1)
  })
})

describe('acceptInvitation (https://github.com/pasosdeJesus/learn.tg/issues/220)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
    setupCommonResponses()
  })

  it('accepts a pending invitation, joins the church and activates the cluster at 3 members', async () => {
    // church, invitation, existingMembership(null), cluster(after join), members(3)
    mockExecuteTakeFirst
      .mockResolvedValueOnce({ id: 20, name: 'Iglesia B', country_id: 694 }) // getPastorChurch
      .mockResolvedValueOnce({ id: 9, clustergd_id: 3, invited_pastor_id: 5, invited_church_id: 20, invited_by_id: 1, status: 'pending' }) // invitation
      .mockResolvedValueOnce(null) // existingMembership
      .mockResolvedValueOnce({ id: 3, name: 'Esperanza', pseudonym: null, status: 'pending', leader_church_id: 11 }) // cluster
      .mockResolvedValueOnce({ created_by: 1 }) // leader's church → notify
    mockExecute.mockResolvedValue([])
    // getClusterMembers (execute on the select chain) → 3 members
    const deps = buildDeps()
    const origDb = deps.db
    // getClusterMembers uses a select chain ending in .execute(); the shared
    // apiDbMocks mockExecute is used by inserts too — members list must return
    // 3 rows so activation triggers. We stub the members query result via the
    // chain: use a dedicated mock for the members select.
    const membersRows = [
      { church_id: 11, church_name: 'A', joined_at: new Date() },
      { church_id: 12, church_name: 'B', joined_at: new Date() },
      { church_id: 20, church_name: 'C', joined_at: new Date() },
    ]
    // Patch: the engine routes use `getClusterMembers` (execute) — with the
    // shared MockKysely, execute() returns mockExecute result. We need the
    // members query (last .execute()) to return 3 rows while inserts resolve [].
    mockExecute.mockReset()
    // Orden de ejecución en acceptInvitation:
    // 1 update cluster_invitation · 2 insert church_clustergd ·
    // 3 addClusterHistory · 4 getClusterMembers (→3) ·
    // 5 update clustergd (active) · 6 history · 7 notify líder · 8 notify invitador
    const execQueue = [undefined, undefined, undefined, membersRows, undefined, undefined, undefined, undefined]
    mockExecute.mockImplementation(() => Promise.resolve(execQueue.shift()))

    const res = await acceptInvitation(deps as GdclusterDeps, post('/api/cluster/invitation/accept', {
      walletAddress: WALLET, token: TOKEN, invitationId: 9,
    }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.activated).toBe(true)
    expect(json.member_count).toBe(3)
    // Update a clustergd → status active
    expect(mockExecute).not.toHaveBeenCalledTimes(0)
  })

  it('rejects an invitation already responded', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce({ id: 20, name: 'Iglesia B', country_id: 694 }) // church
      .mockResolvedValueOnce({ id: 9, clustergd_id: 3, invited_pastor_id: 5, invited_church_id: 20, invited_by_id: 1, status: 'rejected' })
    const res = await acceptInvitation(buildDeps() as GdclusterDeps, post('/api/cluster/invitation/accept', {
      walletAddress: WALLET, token: TOKEN, invitationId: 9,
    }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('already responded')
  })

  it('returns 403 when the invitation is not addressed to the pastor', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce({ id: 20, name: 'Iglesia B', country_id: 694 }) // church
      .mockResolvedValueOnce({ id: 9, clustergd_id: 3, invited_pastor_id: 999, invited_church_id: 20, invited_by_id: 1, status: 'pending' })
    const res = await acceptInvitation(buildDeps() as GdclusterDeps, post('/api/cluster/invitation/accept', {
      walletAddress: WALLET, token: TOKEN, invitationId: 9,
    }))
    expect(res.status).toBe(403)
  })
})

describe('rejectInvitation (https://github.com/pasosdeJesus/learn.tg/issues/220)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
    setupCommonResponses()
  })

  it('marks the invitation as rejected and notifies the inviter', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce({ id: 9, clustergd_id: 3, invited_pastor_id: 5, invited_church_id: 20, invited_by_id: 1, status: 'pending' }) // invitation
      .mockResolvedValueOnce({ id: 3, name: 'Esperanza', pseudonym: null }) // cluster
    mockExecute.mockResolvedValue([])
    const res = await rejectInvitation(buildDeps() as GdclusterDeps, post('/api/cluster/invitation/reject', {
      walletAddress: WALLET, token: TOKEN, invitationId: 9,
    }))
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
    // update (status=rejected) + notify insert
    expect(mockExecute).toHaveBeenCalled()
  })
})
