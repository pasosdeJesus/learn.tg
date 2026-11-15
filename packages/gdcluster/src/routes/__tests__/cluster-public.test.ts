import { describe, it, expect, beforeEach, vi } from 'vitest'
import { apiDbMocks } from '@pasosdejesus/m/test-utils/kysely-mocks'

// GET /api/clusters/[slug] (R-#299): superficie pública del clúster. Nunca publica el
// nombre interno, pastores ni invitaciones; publica la billetera del fondo **sólo**
// mientras se pueda donar (región tipo 1, fondo no liberado y clúster no presentado),
// que es lo que habilita el botón Donar de la página pública.

vi.mock('../../lib/cluster-funds.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/cluster-funds.js')>()
  return { ...actual, clusterFundsByWallet: vi.fn(async () => new Map()) }
})

import { getPublicCluster } from '../gd-public-clusters.js'
import type { GdclusterDeps } from '../../index.js'

const { mockExecuteTakeFirst, mockExecute, mockSqlExecute, resetMocks, setupCommonResponses } = apiDbMocks

const WALLET = '0x1234567890123456789012345678901234567890'

const BASE_CLUSTER = {
  id: 3,
  slug: 'esp',
  status: 'active',
  gd_status: 'requested',
  created_at: new Date('2026-11-01T00:00:00Z'),
  fund_released_at: null,
  fund_released_amount: null,
  fund_released_slearn: null,
  country_id: 1,
  cluster_wallet: WALLET,
}

function deps(): any {
  return { db: () => new apiDbMocks.MockKysely(), authenticateUser: vi.fn(), backend: {} }
}

function queueCluster(overrides: Record<string, unknown> = {}, country: any = { name: 'Colombia', code: 'CO', tipo_region: 1 }) {
  mockExecuteTakeFirst
    .mockResolvedValueOnce({ ...BASE_CLUSTER, ...overrides }) // clustergd
    .mockResolvedValueOnce(country) // msip_pais
    .mockResolvedValueOnce(null) // history (fund_released)
  mockExecute.mockResolvedValue([{ name: 'Iglesia A', joined_at: null }])
  mockSqlExecute.mockResolvedValue({ rows: [{ usdt_total: 0, slearn_total: 0 }] })
}

describe('getPublicCluster — botón Donar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
    setupCommonResponses()
  })

  it('publica la billetera del fondo mientras el clúster se pueda presentar', async () => {
    queueCluster()
    const res = await getPublicCluster(deps() as GdclusterDeps, { slug: 'esp' })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.donation_wallet).toBe(WALLET)
    expect(json.slug).toBe('esp')
    // Privacidad: el nombre interno no viaja.
    expect(json.name).toBeUndefined()
  })

  it('deja de publicarla cuando el fondo ya se liberó', async () => {
    queueCluster({ fund_released_at: new Date('2026-11-10T00:00:00Z') })
    const json = await (await getPublicCluster(deps() as GdclusterDeps, { slug: 'esp' })).json()
    expect(json.donation_wallet).toBeNull()
    expect(json.finished).toBe(true)
  })

  it('deja de publicarla cuando el clúster está presentado a GD', async () => {
    queueCluster({ gd_status: 'sent' })
    const json = await (await getPublicCluster(deps() as GdclusterDeps, { slug: 'esp' })).json()
    expect(json.donation_wallet).toBeNull()
  })

  it('no la publica en un país de región tipo 2', async () => {
    queueCluster({}, { name: 'Restringido', code: 'XX', tipo_region: 2 })
    const json = await (await getPublicCluster(deps() as GdclusterDeps, { slug: 'esp' })).json()
    expect(json.donation_wallet).toBeNull()
  })

  it('responde 404 sin billetera o con el clúster disuelto', async () => {
    queueCluster({ status: 'disbanded' })
    const res = await getPublicCluster(deps() as GdclusterDeps, { slug: 'esp' })
    expect(res.status).toBe(404)
  })
})
