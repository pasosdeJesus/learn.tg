import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { apiDbMocks } from '@pasosdejesus/m/test-utils/kysely-mocks'

import { inviteByWallet } from '../cluster-invitation-wallet.js'
import type { GdclusterDeps } from '../../index.js'

// R-#299: invitación por billetera a un clúster. Sólo el iniciador invita; una billetera
// que no es de un pastor lead de iglesia verificada responde 422 con `reason`, con la
// misma forma para cualquier caso (no se puede enumerar cuentas).

const { mockExecuteTakeFirst, mockExecute, resetMocks, setupCommonResponses } = apiDbMocks

const WALLET = '0x1234567890123456789012345678901234567890'
const INVITED = '0x9876543210987654321098765432109876543210'

function buildDeps(auth: any = {
  usuario: { id: 5, church_id: 11, idioma: 'es_CO', nombre: 'Pastor A', church_relationship: 'pastor' },
  billetera: { billetera: WALLET },
}): any {
  return {
    db: () => new apiDbMocks.MockKysely(),
    authenticateUser: vi.fn().mockResolvedValue(auth),
    backend: {},
  }
}

function post(body: any): NextRequest {
  return new NextRequest('http://localhost/api/cluster/invitation/wallet', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

const INITIATOR_CHURCH = { id: 11, name: 'Iglesia A', country_id: 1, registration_verified: true, deleted_at: null }
const MEMBERSHIP = { clustergd_id: 3, joined_at: null, left_at: null }
const CLUSTER = { id: 3, name: 'Esperanza', slug: 'esp', country_id: 1, initiator_church_id: 11 }
const INVITED_USER = { id: 7, church_relationship: 'pastor', idioma: 'es_CO', nombre: 'Pastor B' }
const INVITED_CHURCH = { id: 20, name: 'Iglesia B', country_id: 1, registration_verified: true, deleted_at: null }

function queueCore(invitedChurch: any = INVITED_CHURCH) {
  mockExecuteTakeFirst
    .mockResolvedValueOnce(INITIATOR_CHURCH) // getPastorChurch(iniciador)
    .mockResolvedValueOnce(MEMBERSHIP) // getChurchCluster(iniciador)
    .mockResolvedValueOnce(CLUSTER) // clustergd
    .mockResolvedValueOnce({ usuario_id: 7 }) // billetera_usuario
    .mockResolvedValueOnce(INVITED_USER) // usuario
    .mockResolvedValueOnce(invitedChurch) // getPastorChurch(invitado)
}

describe('inviteByWallet (R-#299)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
    setupCommonResponses()
  })

  it('requires a session', async () => {
    const deps = buildDeps(null)
    const res = await inviteByWallet(deps as GdclusterDeps, post({ walletAddress: WALLET, invitedWallet: INVITED }))
    expect(res.status).toBe(401)
  })

  it('rejects a malformed wallet address', async () => {
    const res = await inviteByWallet(buildDeps() as GdclusterDeps, post({ walletAddress: WALLET, invitedWallet: '0x123' }))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('invalid_wallet')
  })

  it('answers 403 when the caller is a member but not the initiator', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce(INITIATOR_CHURCH)
      .mockResolvedValueOnce(MEMBERSHIP)
      .mockResolvedValueOnce({ ...CLUSTER, initiator_church_id: 99 })
    const res = await inviteByWallet(buildDeps() as GdclusterDeps, post({ walletAddress: WALLET, invitedWallet: INVITED }))
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('not_initiator')
  })

  it('answers 422 not_lead_pastor for a wallet that is not a pastor', async () => {
    mockExecuteTakeFirst.mockReset()
    mockExecuteTakeFirst
      .mockResolvedValueOnce(INITIATOR_CHURCH)
      .mockResolvedValueOnce(MEMBERSHIP)
      .mockResolvedValueOnce(CLUSTER)
      .mockResolvedValueOnce({ usuario_id: 7 })
      .mockResolvedValueOnce({ ...INVITED_USER, church_relationship: 'member' })
    const res = await inviteByWallet(buildDeps() as GdclusterDeps, post({ walletAddress: WALLET, invitedWallet: INVITED }))
    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.code).toBe('not_invitable')
    expect(json.reason).toBe('not_lead_pastor')
  })

  it('answers 422 church_not_verified when the invited church is not verified', async () => {
    mockExecuteTakeFirst.mockReset()
    queueCore({ ...INVITED_CHURCH, registration_verified: false })
    const res = await inviteByWallet(buildDeps() as GdclusterDeps, post({ walletAddress: WALLET, invitedWallet: INVITED }))
    expect(res.status).toBe(422)
    expect((await res.json()).reason).toBe('church_not_verified')
  })

  it('answers 422 already_in_cluster when the invited pastor is in another cluster', async () => {
    mockExecuteTakeFirst.mockReset()
    mockExecuteTakeFirst
      .mockResolvedValueOnce(INITIATOR_CHURCH)
      .mockResolvedValueOnce(MEMBERSHIP)
      .mockResolvedValueOnce(CLUSTER)
      .mockResolvedValueOnce({ usuario_id: 7 })
      .mockResolvedValueOnce(INVITED_USER)
      .mockResolvedValueOnce(INVITED_CHURCH)
      .mockResolvedValueOnce({ tipo_region: 1 }) // msip_pais
      .mockResolvedValueOnce(null) // churchCompletedCluster
      .mockResolvedValueOnce({ clustergd_id: 8, joined_at: null, left_at: null }) // ya tiene clúster
    const res = await inviteByWallet(buildDeps() as GdclusterDeps, post({ walletAddress: WALLET, invitedWallet: INVITED }))
    expect(res.status).toBe(422)
    expect((await res.json()).reason).toBe('already_in_cluster')
  })

  it('creates the invitation, the history and the notification', async () => {
    mockExecuteTakeFirst.mockReset()
    mockExecuteTakeFirst
      .mockResolvedValueOnce(INITIATOR_CHURCH)
      .mockResolvedValueOnce(MEMBERSHIP)
      .mockResolvedValueOnce(CLUSTER)
      .mockResolvedValueOnce({ usuario_id: 7 })
      .mockResolvedValueOnce(INVITED_USER)
      .mockResolvedValueOnce(INVITED_CHURCH)
      .mockResolvedValueOnce({ tipo_region: 1 })
      .mockResolvedValueOnce(null) // churchCompletedCluster
      .mockResolvedValueOnce(null) // getChurchCluster(invitado)
      .mockResolvedValueOnce(null) // invitación existente
      .mockResolvedValueOnce({ id: 88 }) // insert returning id
    const res = await inviteByWallet(buildDeps() as GdclusterDeps, post({ walletAddress: WALLET, invitedWallet: INVITED }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.invitationId).toBe(88)
    expect(json.reinvited).toBe(false)
    // historia (invitation_sent), notificación y userevent
    expect(mockExecute.mock.calls.length).toBeGreaterThanOrEqual(3)
  })

  it('reopens a rejected invitation once (invite_count 1 → 2)', async () => {
    mockExecuteTakeFirst.mockReset()
    mockExecuteTakeFirst
      .mockResolvedValueOnce(INITIATOR_CHURCH)
      .mockResolvedValueOnce(MEMBERSHIP)
      .mockResolvedValueOnce(CLUSTER)
      .mockResolvedValueOnce({
        id: 88, clustergd_id: 3, invited_pastor_id: 7, invited_church_id: 20,
        status: 'rejected', invite_count: 1, invited_wallet: INVITED,
      })
      .mockResolvedValueOnce(INVITED_USER)
      .mockResolvedValueOnce(INVITED_CHURCH)
      .mockResolvedValueOnce({ tipo_region: 1 })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
    const res = await inviteByWallet(buildDeps() as GdclusterDeps, post({ walletAddress: WALLET, invitationId: 88 }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.reinvited).toBe(true)
    expect(json.invitationId).toBe(88)
  })

  it('answers 422 invite_limit_reached after a second rejection', async () => {
    mockExecuteTakeFirst.mockReset()
    mockExecuteTakeFirst
      .mockResolvedValueOnce(INITIATOR_CHURCH)
      .mockResolvedValueOnce(MEMBERSHIP)
      .mockResolvedValueOnce(CLUSTER)
      .mockResolvedValueOnce({
        id: 88, clustergd_id: 3, invited_pastor_id: 7, invited_church_id: 20,
        status: 'rejected', invite_count: 2,
      })
      .mockResolvedValueOnce(INVITED_USER)
      .mockResolvedValueOnce(INVITED_CHURCH)
      .mockResolvedValueOnce({ tipo_region: 1 })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
    const res = await inviteByWallet(buildDeps() as GdclusterDeps, post({ walletAddress: WALLET, invitationId: 88 }))
    expect(res.status).toBe(422)
    expect((await res.json()).reason).toBe('invite_limit_reached')
  })

  it('answers 404 for an invitation of another cluster', async () => {
    mockExecuteTakeFirst.mockReset()
    mockExecuteTakeFirst
      .mockResolvedValueOnce(INITIATOR_CHURCH)
      .mockResolvedValueOnce(MEMBERSHIP)
      .mockResolvedValueOnce(CLUSTER)
      .mockResolvedValueOnce({ id: 88, clustergd_id: 999 })
    const res = await inviteByWallet(buildDeps() as GdclusterDeps, post({ walletAddress: WALLET, invitationId: 88 }))
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('invitation_not_found')
  })
})
