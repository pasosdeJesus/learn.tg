import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { apiDbMocks } from '@pasosdejesus/m/test-utils/kysely-mocks'

// Indicadores de la página del clúster (R-#299 follow-up): miembros de cada iglesia en
// learn.tg, referidos de su pastor, balances de los fondos del clúster y del país, y
// donaciones al fondo. Las lecturas de cadena y el agregado de donaciones se sustituyen
// para probar el ensamblado de la respuesta.

const helpers = vi.hoisted(() => ({
  getClusterMembers: vi.fn(),
  getClusterHistory: vi.fn(),
  readClusterFunds: vi.fn(),
  readCountryFunds: vi.fn(),
  readClusterDonations: vi.fn(),
}))

vi.mock('../../lib/gd-utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/gd-utils.js')>()
  return {
    ...actual,
    getClusterMembers: (...args: unknown[]) => helpers.getClusterMembers(...args),
    getClusterHistory: (...args: unknown[]) => helpers.getClusterHistory(...args),
  }
})

vi.mock('../../lib/cluster-funds.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/cluster-funds.js')>()
  return {
    ...actual,
    readClusterFunds: (...args: unknown[]) => helpers.readClusterFunds(...args),
    readCountryFunds: (...args: unknown[]) => helpers.readCountryFunds(...args),
    readClusterDonations: (...args: unknown[]) => helpers.readClusterDonations(...args),
  }
})

import { getCluster } from '../gd-cluster.js'
import type { GdclusterDeps } from '../../index.js'

const { mockExecuteTakeFirst, mockExecute, resetMocks, setupCommonResponses } = apiDbMocks

const WALLET = '0x1234567890123456789012345678901234567890'
const CLUSTER = {
  id: 3, name: 'Esperanza', slug: 'esp', country_id: 1,
  status: 'active', initiator_church_id: 20,
}

function deps(): any {
  return { db: () => new apiDbMocks.MockKysely(), authenticateUser: vi.fn().mockResolvedValue(null), backend: {} }
}

describe('getCluster — indicadores del clúster', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
    setupCommonResponses()
    helpers.getClusterMembers.mockResolvedValue([
      { church_id: 20, church_name: 'Iglesia A', joined_at: new Date('2026-11-01T00:00:00Z') },
      { church_id: 21, church_name: 'Iglesia B', joined_at: new Date('2026-11-02T00:00:00Z') },
    ])
    helpers.getClusterHistory.mockResolvedValue([])
    helpers.readClusterFunds.mockResolvedValue({ usdt: 1_000_000n, slearn: 5_000n, exists: true, verified: true })
    helpers.readCountryFunds.mockResolvedValue({ usdt: 2_000_000n, slearn: 9_000n, exists: true })
    helpers.readClusterDonations.mockResolvedValue({ count: 2, usdt_total: 10, slearn_total: 5 })
  })

  it('adds members, referrals, balances and donations to the response', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce(CLUSTER) // clustergd
      .mockResolvedValueOnce({ cluster_wallet: WALLET }) // iglesia iniciadora
      .mockResolvedValueOnce({ name: 'Colombia', code: 'CO' }) // msip_pais (alias name/code)
    const execQueue = [
      [{ church_id: 20, total: '4' }, { church_id: 21, total: '7' }], // usuarios por iglesia
      [{ id: 5, nombre: 'Pastor A', nusuario: 'pa', church_id: 20 }], // pastores
      [{ referrer_id: 5, total: '3' }], // referidos por pastor
    ]
    mockExecute.mockImplementation(() => Promise.resolve(execQueue.shift() ?? []))

    const res = await getCluster(deps() as GdclusterDeps, new NextRequest('http://localhost/api/cluster/3'), { id: '3' })
    expect(res.status).toBe(200)
    const json = await res.json()

    const a = json.members.find((m: any) => m.church_id === 20)
    const b = json.members.find((m: any) => m.church_id === 21)
    expect(a.learners).toBe(4)
    expect(a.pastor_name).toBe('Pastor A')
    expect(a.pastor_referrals).toBe(3)
    expect(b.learners).toBe(7)
    expect(b.pastor_name).toBeNull()
    expect(b.pastor_referrals).toBe(0)

    expect(json.funds.cluster).toEqual({ usdt: '1', slearn: '50' })
    expect(json.funds.country).toEqual({ usdt: '2', slearn: '90' })
    expect(json.donations).toEqual({ count: 2, usdt_total: 10, slearn_total: 5 })
    expect(json.country_name).toBe('Colombia')
    expect(json.country_code).toBe('CO')
  })

  it('returns null balances when the chain cannot be read', async () => {
    helpers.readClusterFunds.mockResolvedValue(null)
    helpers.readCountryFunds.mockResolvedValue(null)
    mockExecuteTakeFirst
      .mockResolvedValueOnce(CLUSTER)
      .mockResolvedValueOnce({ cluster_wallet: null })
      .mockResolvedValueOnce(null) // sin país
    mockExecute.mockResolvedValue([])

    const res = await getCluster(deps() as GdclusterDeps, new NextRequest('http://localhost/api/cluster/3'), { id: '3' })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.funds.cluster).toBeNull()
    expect(json.funds.country).toBeNull()
    expect(json.donations.count).toBe(2) // el agregado de la base sí se informa
  })
})
