import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { apiDbMocks } from '@pasosdejesus/m/test-utils/kysely-mocks'

// R-#161 (2026-10-27): el iniciador del clúster solicita la presentación a Global
// Disciples; la elegibilidad la calcula `lib/gd-presentation.ts` (probado aparte) y
// aquí se verifica el contrato de la ruta: auth, permiso del iniciador, 400 con motivos
// y el registro de la solicitud.

const state = vi.hoisted(() => ({
  readiness: {
    ready: true,
    cluster_status: 'active',
    member_churches: 3,
    pastors: [],
    missing: [] as string[],
    request: null as any,
  },
}))

vi.mock('../../lib/gd-presentation.js', () => ({
  getPresentationReadiness: vi.fn(async () => state.readiness),
}))

import { getPresentation, requestPresentation } from '../gd-presentation.js'
import type { GdclusterDeps } from '../../index.js'

const { mockExecuteTakeFirst, mockExecute, setupMocks, resetMocks, setupCommonResponses } = apiDbMocks

const WALLET = '0x1234567890123456789012345678901234567890'
const INITIATOR_CHURCH = 20
const OTHER_CHURCH = 21

const CLUSTER = {
  id: 3, name: 'Esperanza', code: 'ABC123', country_id: 1, status: 'active',
  initiator_church_id: INITIATOR_CHURCH,
}

function deps(overrides: Record<string, any> = {}): any {
  return {
    db: () => new apiDbMocks.MockKysely(),
    authenticateUser: vi.fn().mockResolvedValue({
      usuario: { id: 5, church_id: INITIATOR_CHURCH, nombre: 'Pastor A', church_relationship: 'pastor' },
      billetera: { billetera: WALLET },
    }),
    ...overrides,
  }
}

function viewer(churchId: number) {
  mockExecuteTakeFirst
    .mockResolvedValueOnce(CLUSTER) // clustergd
    .mockResolvedValueOnce({ id: churchId, name: 'Iglesia', country_id: 1 }) // getPastorChurch
    .mockResolvedValueOnce({ clustergd_id: 3, joined_at: new Date(), left_at: null }) // getChurchCluster
}

function post(body: any = { walletAddress: WALLET }): NextRequest {
  return new NextRequest('http://localhost/api/cluster/3/gd-presentation', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

function get(): NextRequest {
  return new NextRequest(`http://localhost/api/cluster/3/gd-presentation?walletAddress=${WALLET}`)
}

describe('gd-presentation (R-#161)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
    setupCommonResponses()
    state.readiness = {
      ready: true, cluster_status: 'active', member_churches: 3,
      pastors: [], missing: [], request: null,
    }
  })

  it('requires authentication (401)', async () => {
    const d = deps({ authenticateUser: vi.fn().mockResolvedValue(null) })
    const res = await requestPresentation(d as GdclusterDeps, post(), { id: '3' })
    expect(res.status).toBe(401)
  })

  it('rejects a member who is not the initiator (403)', async () => {
    viewer(OTHER_CHURCH)
    const res = await requestPresentation(deps() as GdclusterDeps, post(), { id: '3' })
    expect(res.status).toBe(403)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it('returns 400 with the per-pastor reasons when the cluster is not ready', async () => {
    viewer(INITIATOR_CHURCH)
    state.readiness = {
      ...state.readiness,
      ready: false,
      missing: ['cluster_active'],
      pastors: [{ usuario_id: 5, nombre: 'A', church_id: 20, church_name: 'Iglesia', guides_done: 6, guides_total: 6, course_completed: true, profile_score: 91, invited_pastor: true, invited_member: false, missing: ['invite_member'] }],
    }
    const res = await requestPresentation(deps() as GdclusterDeps, post(), { id: '3' })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.missing).toContain('cluster_active')
    expect(json.pastors[0].missing).toContain('invite_member')
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it('records the request when the initiator asks and the cluster is ready', async () => {
    viewer(INITIATOR_CHURCH)
    mockExecute.mockResolvedValue([])
    const res = await requestPresentation(deps() as GdclusterDeps, post(), { id: '3' })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.request.requested_by).toBe(5)
    // update clustergd + addClusterHistory + userevent
    expect(mockExecute).toHaveBeenCalledTimes(3)
  })

  it('is idempotent when the request already exists', async () => {
    viewer(INITIATOR_CHURCH)
    state.readiness = {
      ...state.readiness,
      request: { requested_at: new Date().toISOString(), requested_by: 5, sent_at: null, sent_by: null, response: null, response_at: null, response_by: null, contact_email: null },
    }
    const res = await requestPresentation(deps() as GdclusterDeps, post(), { id: '3' })
    expect(res.status).toBe(200)
    expect((await res.json()).alreadyRequested).toBe(true)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it('shows the GD answer only to the initiator', async () => {
    viewer(INITIATOR_CHURCH)
    state.readiness = {
      ...state.readiness,
      request: { requested_at: new Date().toISOString(), requested_by: 5, sent_at: new Date().toISOString(), sent_by: 1, response: 'Escriban a director@example.org', response_at: new Date().toISOString(), response_by: 1, contact_email: 'director@example.org' },
    }
    const res = await getPresentation(deps() as GdclusterDeps, get(), { id: '3' })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.isInitiator).toBe(true)
    expect(json.request.response).toContain('director@example.org')
    expect(json.request.contact_email).toBe('director@example.org')
  })

  it('hides the answer from a member who is not the initiator', async () => {
    viewer(OTHER_CHURCH)
    state.readiness = {
      ...state.readiness,
      request: { requested_at: new Date().toISOString(), requested_by: 5, sent_at: null, sent_by: null, response: 'private', response_at: null, response_by: null, contact_email: 'director@example.org' },
    }
    const res = await getPresentation(deps() as GdclusterDeps, get(), { id: '3' })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.isInitiator).toBe(false)
    expect(json.request.response).toBeUndefined()
    expect(json.request.contact_email).toBeUndefined()
  })

  it('rejects a viewer from outside the cluster (403)', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce(CLUSTER)
      .mockResolvedValueOnce({ id: OTHER_CHURCH, name: 'Otra', country_id: 1 })
      .mockResolvedValueOnce({ clustergd_id: 99, joined_at: new Date(), left_at: null })
    const res = await getPresentation(deps() as GdclusterDeps, get(), { id: '3' })
    expect(res.status).toBe(403)
  })
})
