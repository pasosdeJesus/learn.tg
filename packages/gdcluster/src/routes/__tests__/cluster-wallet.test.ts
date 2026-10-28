import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { apiDbMocks } from '@pasosdejesus/m/test-utils/kysely-mocks'
import { getAddress } from 'viem'

import { updateCluster, getCluster } from '../gd-cluster.js'
import type { GdclusterDeps } from '../../index.js'

// R-#220: la billetera del clúster (`church.cluster_wallet` de la iglesia iniciadora) la
// configura el **iniciador** del clúster, no el verificador. Se recomienda una multisig
// con las billeteras de los pastores; cambiarla no mueve los fondos ya acreditados.

// `readClusterFunds` resuelve la dirección de ClusterFundsV2 desde los deployments del
// repo (que no están en el paquete): se fija para la prueba.
const FUNDS = vi.hoisted(() => ({ usdt: 0n, slearn: 0n, exists: true, verified: true }))
vi.mock('../../lib/gd-cluster-routing.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/gd-cluster-routing.js')>()),
  getClusterFundsAddress: async () => '0x00000000000000000000000000000000000000ff',
}))

const { mockExecuteTakeFirst, mockExecute, setupMocks, resetMocks, setupCommonResponses } = apiDbMocks

const WALLET = '0x1234567890123456789012345678901234567890'
const OLD = '0x0000000000000000000000000000000000000001'
const NEW = '0x0e2a3e05bc9a16f5292a6170456a710cb89c6f72'

const CHURCH = { id: 20, name: 'Iglesia iniciadora', country_id: 1, cluster_wallet: OLD }
const MEMBERSHIP = { clustergd_id: 3, joined_at: new Date(), left_at: null }
const CLUSTER = {
  id: 3, name: 'Esperanza', pseudonym: null, code: 'ABC123', country_id: 1,
  created_at: new Date(), initiator_church_id: 20, status: 'active',
}

function buildDeps(overrides: Record<string, any> = {}): any {
  return {
    db: () => new apiDbMocks.MockKysely(),
    authenticateUser: vi.fn().mockResolvedValue({
      usuario: { id: 5, church_id: 20, nombre: 'Pastor A', church_relationship: 'pastor' },
      billetera: { billetera: WALLET },
    }),
    backend: {
      getPublicClient: () => ({
        readContract: vi.fn().mockResolvedValue([
          FUNDS.usdt, FUNDS.slearn, FUNDS.exists, FUNDS.verified,
        ]),
      }),
    },
    ...overrides,
  }
}

function patch(id: number | string, body: any): NextRequest {
  return new NextRequest(`http://localhost/api/cluster/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ walletAddress: WALLET, ...body }),
  })
}

describe('updateCluster — cluster wallet (R-#220)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
    setupCommonResponses()
    FUNDS.usdt = 0n
    FUNDS.slearn = 0n
  })

  it('lets the leader set the cluster wallet and returns the checksummed address', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce(CHURCH) // getPastorChurch
      .mockResolvedValueOnce(MEMBERSHIP) // getChurchCluster
      .mockResolvedValueOnce(CLUSTER) // clustergd
      .mockResolvedValueOnce({ id: 20, cluster_wallet: OLD }) // church to update
    mockExecute.mockResolvedValue([])

    const res = await updateCluster(buildDeps() as GdclusterDeps, patch(3, { clusterWallet: NEW }), { id: '3' })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.cluster_wallet).toBe(getAddress(NEW))
    // update clustergd + update church + history + userevent
    expect(mockExecute).toHaveBeenCalledTimes(4)
  })

  it('clears the wallet when the leader sends an empty value', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce(CHURCH)
      .mockResolvedValueOnce(MEMBERSHIP)
      .mockResolvedValueOnce(CLUSTER)
      .mockResolvedValueOnce({ id: 20, cluster_wallet: OLD })
    mockExecute.mockResolvedValue([])

    const res = await updateCluster(buildDeps() as GdclusterDeps, patch(3, { clusterWallet: '' }), { id: '3' })
    expect(res.status).toBe(200)
    expect((await res.json()).cluster_wallet).toBeNull()
  })

  it('rejects an invalid address with 400 before writing anything', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce(CHURCH)
      .mockResolvedValueOnce(MEMBERSHIP)
      .mockResolvedValueOnce(CLUSTER)

    const res = await updateCluster(buildDeps() as GdclusterDeps, patch(3, { clusterWallet: '0x123' }), { id: '3' })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/Invalid wallet address/)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it('rejects a member who is not the leader (403)', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce({ ...CHURCH, id: 21 }) // another church of the cluster
      .mockResolvedValueOnce(MEMBERSHIP)
      .mockResolvedValueOnce(CLUSTER)

    const res = await updateCluster(buildDeps() as GdclusterDeps, patch(3, { clusterWallet: NEW }), { id: '3' })
    expect(res.status).toBe(403)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it('requires authentication (401)', async () => {
    const deps = buildDeps({ authenticateUser: vi.fn().mockResolvedValue(null) })
    const res = await updateCluster(deps as GdclusterDeps, patch(3, { clusterWallet: NEW }), { id: '3' })
    expect(res.status).toBe(401)
  })

  // El fondo de ClusterFundsV2 está indexado por la billetera: cambiarla con saldo deja
  // los fondos viejos huérfanos (R-#161 §riesgos, R-#220 §4).
  it('refuses to change a wallet that already holds funds (409)', async () => {
    FUNDS.usdt = 1_500_000n // 1.50 USDT
    mockExecuteTakeFirst
      .mockResolvedValueOnce(CHURCH)
      .mockResolvedValueOnce(MEMBERSHIP)
      .mockResolvedValueOnce(CLUSTER)
      .mockResolvedValueOnce({ id: 20, cluster_wallet: OLD })

    const res = await updateCluster(buildDeps() as GdclusterDeps, patch(3, { clusterWallet: NEW }), { id: '3' })
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.code).toBe('cluster_wallet_has_funds')
    expect(json.funds.usdt).toBe('1.5')
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it('changes the wallet with funds when the initiator confirms, and records what is left', async () => {
    FUNDS.slearn = 2_000n // 20.00 SLEARN
    mockExecuteTakeFirst
      .mockResolvedValueOnce(CHURCH)
      .mockResolvedValueOnce(MEMBERSHIP)
      .mockResolvedValueOnce(CLUSTER)
      .mockResolvedValueOnce({ id: 20, cluster_wallet: OLD })
    mockExecute.mockResolvedValue([])

    const res = await updateCluster(
      buildDeps() as GdclusterDeps,
      patch(3, { clusterWallet: NEW, confirmMigrate: true }),
      { id: '3' },
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.funds_left_in_previous_wallet.slearn).toBe('20')
    // update clustergd + update church + history + userevent
    expect(mockExecute).toHaveBeenCalledTimes(4)
  })

  it('flags the change as unchecked when the funds could not be read', async () => {
    const deps = buildDeps({
      backend: { getPublicClient: () => ({ readContract: vi.fn().mockRejectedValue(new Error('rpc down')) }) },
    })
    mockExecuteTakeFirst
      .mockResolvedValueOnce(CHURCH)
      .mockResolvedValueOnce(MEMBERSHIP)
      .mockResolvedValueOnce(CLUSTER)
      .mockResolvedValueOnce({ id: 20, cluster_wallet: OLD })
    mockExecute.mockResolvedValue([])

    const res = await updateCluster(deps as GdclusterDeps, patch(3, { clusterWallet: NEW }), { id: '3' })
    expect(res.status).toBe(200)
    expect((await res.json()).funds_unchecked).toBe(true)
  })
})

describe('getCluster — viewer role (R-#220)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
    setupCommonResponses()
  })

  it('tells the cluster initiator that they can edit (isInitiator: true)', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce(CLUSTER) // clustergd
      .mockResolvedValueOnce({ cluster_wallet: OLD }) // leader church
      .mockResolvedValueOnce(CHURCH) // getPastorChurch for the viewer
    mockExecute.mockResolvedValue([])

    const req = new NextRequest(`http://localhost/api/cluster/3?walletAddress=${WALLET}`)
    const res = await getCluster(buildDeps() as GdclusterDeps, req, { id: '3' })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.isInitiator).toBe(true)
    expect(json.cluster_wallet).toBe(OLD)
  })

  it('does not grant edit rights to an anonymous viewer', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce(CLUSTER)
      .mockResolvedValueOnce({ cluster_wallet: OLD })
    mockExecute.mockResolvedValue([])

    const res = await getCluster(buildDeps() as GdclusterDeps, new NextRequest('http://localhost/api/cluster/3'), { id: '3' })
    expect(res.status).toBe(200)
    expect((await res.json()).isInitiator).toBe(false)
  })
})
