import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { apiDbMocks } from '@pasosdejesus/m/test-utils/kysely-mocks'

// Contrato de auth de las rutas del clúster (R-#161): cada handler exige sesión
// (401 sin credencial) y el rol correcto (403 con el rol equivocado). Acompaña a la
// lista explícita de doc/api-security.md y a la auditoría, que ahora resuelve los
// re-exports del motor.

import { getPresentation, requestPresentation, cancelPresentation, updatePresentation } from '../gd-presentation.js'
import { approvePresentation, getApprovals } from '../cluster-approval.js'
import { updateBudget, updateDirector } from '../gd-presentation-data.js'
import type { GdclusterDeps } from '../../index.js'

const { mockExecuteTakeFirst, mockExecute, resetMocks, setupCommonResponses } = apiDbMocks

const WALLET = '0x1234567890123456789012345678901234567890'
const INITIATOR_CHURCH = 20
const OTHER_CHURCH = 21
const CLUSTER = {
  id: 3, name: 'Esperanza', code: 'ABC123', country_id: 1, status: 'active',
  initiator_church_id: INITIATOR_CHURCH, gd_status: null,
}

function deps(overrides: Record<string, any> = {}): any {
  return {
    db: () => new apiDbMocks.MockKysely(),
    authenticateUser: vi.fn().mockResolvedValue({
      usuario: { id: 5, church_id: INITIATOR_CHURCH, church_relationship: 'pastor' },
      billetera: { billetera: WALLET },
    }),
    authenticateAdmin: vi.fn().mockResolvedValue(null),
    ...overrides,
  }
}

function memberships(churchId: number, clusterId = 3) {
  mockExecuteTakeFirst
    .mockResolvedValueOnce(CLUSTER)
    .mockResolvedValueOnce({ id: churchId, name: 'Iglesia', country_id: 1 })
    .mockResolvedValueOnce({ clustergd_id: clusterId, joined_at: new Date(), left_at: null })
}

function get(params = ''): NextRequest {
  return new NextRequest(`http://localhost/api/cluster/3/gd-presentation${params}`)
}
function postJson(path: string, body: any): NextRequest {
  return new NextRequest(`http://localhost/api/cluster/3/${path}`, { method: 'POST', body: JSON.stringify(body) })
}
function putJson(path: string, body: any): NextRequest {
  return new NextRequest(`http://localhost/api/cluster/3/${path}`, { method: 'PUT', body: JSON.stringify(body) })
}

describe('auth of the cluster routes (R-#161)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
    setupCommonResponses()
    mockExecute.mockResolvedValue([])
  })

  it('gd-presentation GET: 401 without a session', async () => {
    const res = await getPresentation(deps({ authenticateUser: vi.fn().mockResolvedValue(null) }) as GdclusterDeps, get(`?walletAddress=${WALLET}`), { id: '3' })
    expect(res.status).toBe(401)
  })

  it('gd-presentation GET: 403 for a church outside the cluster', async () => {
    memberships(OTHER_CHURCH, 99)
    const res = await getPresentation(deps() as GdclusterDeps, get(`?walletAddress=${WALLET}`), { id: '3' })
    expect(res.status).toBe(403)
  })

  it('gd-presentation POST: 401 without a wallet hint', async () => {
    const res = await requestPresentation(deps() as GdclusterDeps, postJson('gd-presentation', {}), { id: '3' })
    expect(res.status).toBe(401)
  })

  it('gd-presentation POST: 403 for a member who is not the initiator', async () => {
    memberships(OTHER_CHURCH)
    const res = await requestPresentation(deps() as GdclusterDeps, postJson('gd-presentation', { walletAddress: WALLET }), { id: '3' })
    expect(res.status).toBe(403)
  })

  it('gd-presentation PUT: 403 without admin role', async () => {
    const res = await updatePresentation(deps() as GdclusterDeps, putJson('gd-presentation', { walletAddress: WALLET, status: 'under_review' }), { id: '3' })
    expect(res.status).toBe(403)
  })

  it('gd-presentation DELETE: 401 without a session', async () => {
    const res = await cancelPresentation(
      deps({ authenticateUser: vi.fn().mockResolvedValue(null) }) as GdclusterDeps,
      get(`?walletAddress=${WALLET}`),
      { id: '3' },
    )
    expect(res.status).toBe(401)
  })

  it('gd-presentation DELETE: 403 for a member who is not the initiator', async () => {
    memberships(OTHER_CHURCH)
    const res = await cancelPresentation(deps() as GdclusterDeps, get(`?walletAddress=${WALLET}`), { id: '3' })
    expect(res.status).toBe(403)
  })

  it('approval POST: 401 without a session', async () => {
    const res = await approvePresentation(
      deps({ authenticateUser: vi.fn().mockResolvedValue(null) }) as GdclusterDeps,
      postJson('approval', { walletAddress: WALLET }),
      { id: '3' },
    )
    expect(res.status).toBe(401)
  })

  it('approval POST: 403 for a user who is not the principal pastor', async () => {
    mockExecuteTakeFirst.mockResolvedValueOnce(CLUSTER)
    const res = await approvePresentation(
      deps({
        authenticateUser: vi.fn().mockResolvedValue({
          usuario: { id: 5, church_id: INITIATOR_CHURCH, church_relationship: 'member' },
          billetera: { billetera: WALLET },
        }),
      }) as GdclusterDeps,
      postJson('approval', { walletAddress: WALLET }),
      { id: '3' },
    )
    expect(res.status).toBe(403)
  })

  it('approval POST: 403 for a pastor of a church outside the cluster', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce(CLUSTER)
      .mockResolvedValueOnce({ id: 7 })
    const res = await approvePresentation(deps() as GdclusterDeps, postJson('approval', { walletAddress: WALLET }), { id: '3' })
    expect(res.status).toBe(403)
  })

  it('approval GET: 401 without a session', async () => {
    const res = await getApprovals(
      deps({ authenticateUser: vi.fn().mockResolvedValue(null) }) as GdclusterDeps,
      get(`?walletAddress=${WALLET}`),
      { id: '3' },
    )
    expect(res.status).toBe(401)
  })

  it('approval GET: 403 for a church outside the cluster', async () => {
    memberships(OTHER_CHURCH, 99)
    const res = await getApprovals(deps() as GdclusterDeps, get(`?walletAddress=${WALLET}`), { id: '3' })
    expect(res.status).toBe(403)
  })

  it('budget PUT: 401 without a session', async () => {
    const res = await updateBudget(
      deps({ authenticateUser: vi.fn().mockResolvedValue(null) }) as GdclusterDeps,
      putJson('budget', { walletAddress: WALLET, firstYearBudget: 500 }),
      { id: '3' },
    )
    expect(res.status).toBe(401)
  })

  it('budget PUT: 403 for a member who is not the initiator', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce(CLUSTER)
      .mockResolvedValueOnce({ id: OTHER_CHURCH, name: 'Otra', country_id: 1 })
    const res = await updateBudget(deps() as GdclusterDeps, putJson('budget', { walletAddress: WALLET, firstYearBudget: 500 }), { id: '3' })
    expect(res.status).toBe(403)
  })

  it('director PUT: 401 without a session', async () => {
    const res = await updateDirector(
      deps({ authenticateUser: vi.fn().mockResolvedValue(null) }) as GdclusterDeps,
      putJson('director', { walletAddress: WALLET, directorFirstYearPay: 180 }),
      { id: '3' },
    )
    expect(res.status).toBe(401)
  })

  it('director PUT: 403 for a member who is not the initiator', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce(CLUSTER)
      .mockResolvedValueOnce({ id: OTHER_CHURCH, name: 'Otra', country_id: 1 })
    const res = await updateDirector(deps() as GdclusterDeps, putJson('director', { walletAddress: WALLET, directorFirstYearPay: 180 }), { id: '3' })
    expect(res.status).toBe(403)
  })
})
