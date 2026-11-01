import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { apiDbMocks } from '@pasosdejesus/m/test-utils/kysely-mocks'

// Retiro del fondo del clúster (R-#161): solo se vota cuando Global Disciples respondió
// y el fondo no se ha liberado. La liberación en cadena se prueba en el flujo E2E; aquí
// se fija el contrato de las rutas (auth, permiso y guardas).

import { castWithdrawVote } from '../cluster-withdraw.js'
import type { GdclusterDeps } from '../../index.js'

const { mockExecuteTakeFirst, mockExecute, setupMocks, resetMocks, setupCommonResponses } = apiDbMocks

const WALLET = '0x1234567890123456789012345678901234567890'
const INITIATOR_CHURCH = 20
const OTHER_CHURCH = 21

function cluster(overrides: Record<string, any> = {}) {
  return {
    id: 3,
    name: 'Esperanza',
    status: 'active',
    initiator_church_id: INITIATOR_CHURCH,
    gd_status: 'answered',
    ranking_exited_at: null,
    fund_released_at: null,
    first_year_budget: 500,
    ...overrides,
  }
}

function deps(overrides: Record<string, any> = {}): any {
  return {
    db: () => new apiDbMocks.MockKysely(),
    authenticateUser: vi.fn().mockResolvedValue({
      usuario: { id: 5, church_id: INITIATOR_CHURCH, church_relationship: 'pastor' },
      billetera: { billetera: WALLET },
    }),
    ...overrides,
  }
}

function viewer(
  churchId: number,
  clusterOverrides: Record<string, any> = {},
  membershipClusterId = 3,
) {
  mockExecuteTakeFirst
    .mockResolvedValueOnce(cluster(clusterOverrides))
    .mockResolvedValueOnce({ id: churchId, name: 'Iglesia', country_id: 1 })
    .mockResolvedValueOnce({ clustergd_id: membershipClusterId, joined_at: new Date(), left_at: null })
}

function post(): NextRequest {
  return new NextRequest('http://localhost/api/cluster/3/withdraw', {
    method: 'POST',
    body: JSON.stringify({ walletAddress: WALLET }),
  })
}

describe('POST /api/cluster/[id]/withdraw (R-#161)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
    setupCommonResponses()
    mockExecute.mockResolvedValue([])
  })

  it('requires authentication (401)', async () => {
    const res = await castWithdrawVote(
      deps({ authenticateUser: vi.fn().mockResolvedValue(null) }) as GdclusterDeps,
      post(),
      { id: '3' },
    )
    expect(res.status).toBe(401)
  })

  it('rejects a pastor from outside the cluster (403)', async () => {
    viewer(OTHER_CHURCH, {}, 99)
    const res = await castWithdrawVote(deps() as GdclusterDeps, post(), { id: '3' })
    expect(res.status).toBe(403)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it('does not enable the vote before Global Disciples answers (409)', async () => {
    viewer(INITIATOR_CHURCH, { gd_status: 'sent' })
    const res = await castWithdrawVote(deps() as GdclusterDeps, post(), { id: '3' })
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('gd_not_answered')
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it('rejects a second vote once the fund was released (409)', async () => {
    viewer(INITIATOR_CHURCH, { fund_released_at: new Date() })
    const res = await castWithdrawVote(deps() as GdclusterDeps, post(), { id: '3' })
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('already_released')
    expect(mockExecute).not.toHaveBeenCalled()
  })
})
