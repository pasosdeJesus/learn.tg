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
    missing_data: [] as string[],
    request: null as any,
  },
}))

vi.mock('../../lib/gd-presentation.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/gd-presentation.js')>()
  return { ...actual, getPresentationReadiness: vi.fn(async () => state.readiness) }
})

vi.mock('../../lib/cluster-release.js', () => ({
  releaseOnAnswered: vi.fn(async () => ({ distribution: null, release: '0xrelease', errors: [] })),
  redistributeCountryFund: vi.fn(async () => null),
  releaseClusterFund: vi.fn(async () => '0xrelease'),
}))

vi.mock('../../lib/cluster-funds.js', () => ({
  setClusterVerified: vi.fn(async () => '0xverify'),
  // The cluster fund is validated when the initiator presents it: by default it has
  // money, so the request tests keep exercising the happy path.
  readClusterFunds: vi.fn(async () => ({ usdt: 10000000n, slearn: 500n, exists: true, verified: false })),
}))

import { getPresentation, requestPresentation, updatePresentation, cancelPresentation } from '../gd-presentation.js'
import { releaseOnAnswered } from '../../lib/cluster-release.js'
import { readClusterFunds } from '../../lib/cluster-funds.js'
import type { GdclusterDeps } from '../../index.js'

const { mockExecuteTakeFirst, mockExecute, setupMocks, resetMocks, setupCommonResponses } = apiDbMocks

const WALLET = '0x1234567890123456789012345678901234567890'
const INITIATOR_CHURCH = 20
const OTHER_CHURCH = 21

const CLUSTER = {
  id: 3, name: 'Esperanza', code: 'ABC123', country_id: 1, status: 'active',
  initiator_church_id: INITIATOR_CHURCH,
  gd_status: null as string | null,
  gd_requested_at: null as Date | null,
  gd_sent_at: null as Date | null,
  first_year_budget: 500,
  budget_draft_path: 'cluster/3/budget.pdf',
  director_offer_path: 'cluster/3/director.pdf',
  director_first_year_pay: 180,
  director_first_year_hours: 320,
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

function viewer(churchId: number, cluster: Record<string, any> = {}) {
  mockExecuteTakeFirst
    .mockResolvedValueOnce({ ...CLUSTER, ...cluster }) // clustergd
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
      pastors: [], missing: [], missing_data: [], request: null,
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
    // El 400 se explica solo: motivos en palabras, no sólo códigos.
    expect(json.code).toBe('not_ready')
    expect(json.reasons).toContain('The cluster is not active yet')
    expect(json.reasons.join(' | ')).toMatch(/Iglesia \(A\).*member or leader of their own church/)
    expect(json.pastors[0].reasons).toHaveLength(1)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it('explains missing guides, score and data in the 400', async () => {
    viewer(INITIATOR_CHURCH, {
      first_year_budget: null,
      budget_draft_path: null,
    })
    state.readiness = {
      ...state.readiness,
      ready: false,
      missing: ['approvals'],
      pastors: [
        { usuario_id: 5, nombre: 'Ana', church_id: 20, church_name: 'Esperanza', guides_done: 4, guides_total: 6, course_completed: false, profile_score: 70, invited_pastor: false, invited_member: true, missing: ['course', 'score', 'invite_pastor'] },
      ],
    }
    const res = await requestPresentation(deps() as GdclusterDeps, post(), { id: '3' })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.missing_data).toEqual(['budget_total', 'budget_pdf'])
    const joined = json.reasons.join(' | ')
    expect(joined).toMatch(/approved the presentation data/)
    expect(joined).toMatch(/Esperanza \(Ana\): finished 4 of 6 guides/)
    expect(joined).toMatch(/profile score is 70/)
    expect(joined).toMatch(/has not invited a pastor or co-pastor/)
    expect(joined).toMatch(/the first year budget/)
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
    viewer(INITIATOR_CHURCH, { gd_status: 'requested', gd_requested_at: new Date() })
    state.readiness = {
      ...state.readiness,
      request: { requested_at: new Date().toISOString(), requested_by: 5, sent_at: null, sent_by: null, response: null, response_at: null, response_by: null, contact_email: null },
    }
    const res = await requestPresentation(deps() as GdclusterDeps, post(), { id: '3' })
    expect(res.status).toBe(200)
    expect((await res.json()).alreadyRequested).toBe(true)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it('returns the readiness reasons in words in the GET view', async () => {
    viewer(INITIATOR_CHURCH)
    state.readiness = {
      ...state.readiness,
      ready: false,
      missing: ['cluster_wallet'],
      missing_data: ['budget_pdf'],
    }
    const res = await getPresentation(deps() as GdclusterDeps, get(), { id: '3' })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.reasons).toEqual([
      'The cluster wallet (the initiator church wallet) is not set',
      'The presentation data is missing: the budget PDF',
    ])
    expect(json.missing).toEqual(['cluster_wallet'])
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

  it('rejects the request (400) when the budget or the director offer is missing', async () => {
    viewer(INITIATOR_CHURCH, { first_year_budget: null, director_offer_path: null })
    const res = await requestPresentation(deps() as GdclusterDeps, post(), { id: '3' })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.missing_data).toContain('budget_total')
    expect(json.missing_data).toContain('director_offer_pdf')
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it('lets pdJ return the request with suggestions and unlocks the data', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce({ ...CLUSTER, gd_status: 'under_review', gd_requested_at: new Date() })
      .mockResolvedValueOnce({ numUpdatedRows: 1n }) // conditional update applied (the state is the lock)
      .mockResolvedValueOnce({ usuario_id: 5, idioma: 'es' })
    mockExecute.mockResolvedValue([])
    const admin = { usuario_id: 1, billetera: WALLET }
    const req = new NextRequest('http://localhost/api/cluster/3/gd-presentation', {
      method: 'PUT',
      body: JSON.stringify({ walletAddress: WALLET, status: 'returned', evaluation: 'Falta el transporte', suggestions: 'Ajusta el total' }),
    })
    const res = await updatePresentation(deps({ authenticateAdmin: vi.fn().mockResolvedValue(admin) }) as GdclusterDeps, req, { id: '3' })
    expect(res.status).toBe(200)
    // history + userevent + notificación al iniciador (el UPDATE va por executeTakeFirst,
    // porque es condicional al estado actual: el estado es el candado)
    expect(mockExecute.mock.calls.length).toBeGreaterThanOrEqual(3)
  })

  it('requires an admin to move the presentation state (403)', async () => {
    const req = new NextRequest('http://localhost/api/cluster/3/gd-presentation', {
      method: 'PUT',
      body: JSON.stringify({ walletAddress: WALLET, status: 'under_review' }),
    })
    const res = await updatePresentation(deps({ authenticateAdmin: vi.fn().mockResolvedValue(null) }) as GdclusterDeps, req, { id: '3' })
    expect(res.status).toBe(403)
  })

  it('rejects an invalid transition (409)', async () => {
    mockExecuteTakeFirst.mockResolvedValueOnce({ ...CLUSTER, gd_status: 'requested', gd_requested_at: new Date() })
    const req = new NextRequest('http://localhost/api/cluster/3/gd-presentation', {
      method: 'PUT',
      body: JSON.stringify({ walletAddress: WALLET, status: 'answered' }),
    })
    const res = await updatePresentation(deps({ authenticateAdmin: vi.fn().mockResolvedValue({ usuario_id: 1 }) }) as GdclusterDeps, req, { id: '3' })
    expect(res.status).toBe(409)
  })

  it('lets the initiator cancel while pdJ has not reviewed it', async () => {
    viewer(INITIATOR_CHURCH, { gd_status: 'requested', gd_requested_at: new Date() })
    mockExecute.mockResolvedValue([])
    const res = await cancelPresentation(deps() as GdclusterDeps, get(), { id: '3' })
    expect(res.status).toBe(200)
    expect((await res.json()).request.status).toBe('cancelled')
    // update clustergd + history + userevent
    expect(mockExecute).toHaveBeenCalledTimes(3)
  })

  it('rejects the cancel once pdJ is reviewing it (409)', async () => {
    viewer(INITIATOR_CHURCH, { gd_status: 'under_review', gd_requested_at: new Date() })
    const res = await cancelPresentation(deps() as GdclusterDeps, get(), { id: '3' })
    expect(res.status).toBe(409)
  })

  it('rejects a viewer from outside the cluster (403)', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce(CLUSTER)
      .mockResolvedValueOnce({ id: OTHER_CHURCH, name: 'Otra', country_id: 1 })
      .mockResolvedValueOnce({ clustergd_id: 99, joined_at: new Date(), left_at: null })
    const res = await getPresentation(deps() as GdclusterDeps, get(), { id: '3' })
    expect(res.status).toBe(403)
  })
  // Un pastor/clúster no puede recibir los recursos dos veces: al responder GD el
  // estado queda en answered (terminal) y el fondo se libera una sola vez. Estas
  // pruebas cubren la puerta de la ruta; el reparto y la liberación tienen las suyas
  // en lib/__tests__/cluster-release.test.ts.
  describe('answering Global Disciples releases the funds once (R-#161)', () => {
    const adminDeps = () => deps({ authenticateAdmin: vi.fn().mockResolvedValue({ usuario_id: 1 }) })

    function adminAnsweredRequest(): NextRequest {
      return new NextRequest('http://localhost/api/cluster/3/gd-presentation', {
        method: 'PUT',
        body: JSON.stringify({ walletAddress: WALLET, status: 'answered', response: 'Yes' }),
      })
    }

    it('releases once when moving sent -> answered', async () => {
      vi.mocked(releaseOnAnswered).mockClear()
      mockExecuteTakeFirst
        .mockResolvedValueOnce({ ...CLUSTER, gd_status: 'sent', gd_requested_at: new Date() }) // clustergd
        .mockResolvedValueOnce({ numUpdatedRows: 1n }) // conditional update applied
      mockExecute.mockResolvedValue([])

      const res = await updatePresentation(adminDeps() as GdclusterDeps, adminAnsweredRequest(), { id: '3' })

      expect(res.status).toBe(200)
      expect(vi.mocked(releaseOnAnswered)).toHaveBeenCalledTimes(1)
    })

    it('retries only the release when the answer is recorded but the fund was not released', async () => {
      vi.mocked(releaseOnAnswered).mockClear()
      mockExecuteTakeFirst.mockResolvedValueOnce({
        ...CLUSTER,
        gd_status: 'answered',
        gd_requested_at: new Date(),
        fund_released_at: null,
      })

      const res = await updatePresentation(adminDeps() as GdclusterDeps, adminAnsweredRequest(), { id: '3' })

      expect(res.status).toBe(200)
      expect(vi.mocked(releaseOnAnswered)).toHaveBeenCalledTimes(1)
    })

    it('refuses to answer again once the fund was released', async () => {
      vi.mocked(releaseOnAnswered).mockClear()
      mockExecuteTakeFirst.mockResolvedValueOnce({
        ...CLUSTER,
        gd_status: 'answered',
        gd_requested_at: new Date(),
        fund_released_at: new Date(),
      })

      const res = await updatePresentation(adminDeps() as GdclusterDeps, adminAnsweredRequest(), { id: '3' })

      expect(res.status).toBe(409)
      expect(vi.mocked(releaseOnAnswered)).not.toHaveBeenCalled()
    })

    it('refuses the second of two simultaneous answers (the state is the lock)', async () => {
      vi.mocked(releaseOnAnswered).mockClear()
      mockExecuteTakeFirst
        .mockResolvedValueOnce({ ...CLUSTER, gd_status: 'sent', gd_requested_at: new Date() })
        .mockResolvedValueOnce({ numUpdatedRows: 0n }) // another request moved it first

      const res = await updatePresentation(adminDeps() as GdclusterDeps, adminAnsweredRequest(), { id: '3' })
      const body = await res.json()

      expect(res.status).toBe(409)
      expect(body.code).toBe('stale_status')
      expect(vi.mocked(releaseOnAnswered)).not.toHaveBeenCalled()
    })
  })
})
// A cluster cannot be presented before its fund has money (operator decision,
// 2026-11-05): the contract would not verify it and the failure would be silent.
// The check runs when the initiator asks and again when pdJ sends it.
describe('presenting a cluster requires money in its fund (R-#161)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
    setupCommonResponses()
    mockExecute.mockResolvedValue([])
  })

  it('refuses the request when the fund is empty (409 cluster_fund_empty)', async () => {
    vi.mocked(readClusterFunds).mockResolvedValueOnce({ usdt: 0n, slearn: 0n, exists: false, verified: false })
    mockExecuteTakeFirst
      .mockResolvedValueOnce({ ...CLUSTER, gd_status: null, gd_requested_at: null })
      .mockResolvedValueOnce({ id: INITIATOR_CHURCH, name: 'Iglesia', country_id: 1 })
      .mockResolvedValueOnce({ clustergd_id: 3, joined_at: new Date(), left_at: null })
      .mockResolvedValueOnce({ cluster_wallet: '0x00000000000000000000000000000000000000dd' })

    const res = await requestPresentation(deps() as GdclusterDeps, post(), { id: '3' })
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.code).toBe('cluster_fund_empty')
  })

  it('answers 503 when the fund cannot be read', async () => {
    vi.mocked(readClusterFunds).mockResolvedValueOnce(null)
    mockExecuteTakeFirst
      .mockResolvedValueOnce({ ...CLUSTER, gd_status: null, gd_requested_at: null })
      .mockResolvedValueOnce({ id: INITIATOR_CHURCH, name: 'Iglesia', country_id: 1 })
      .mockResolvedValueOnce({ clustergd_id: 3, joined_at: new Date(), left_at: null })
      .mockResolvedValueOnce({ cluster_wallet: '0x00000000000000000000000000000000000000dd' })

    const res = await requestPresentation(deps() as GdclusterDeps, post(), { id: '3' })
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.code).toBe('cluster_fund_unreadable')
  })
})
