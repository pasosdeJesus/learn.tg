import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { apiDbMocks } from '@pasosdejesus/m/test-utils/kysely-mocks'

// Verificador de clústeres (https://github.com/pasosdeJesus/learn.tg/issues/220 §5) y
// presentación a GD (https://github.com/pasosdeJesus/learn.tg/issues/161): el detalle usa
// el vocabulario `initiator_church` y los campos de GD solo se escriben sobre un clúster
// que ya solicitó la presentación, notificando al iniciador.

const helpers = vi.hoisted(() => ({
  getClusterMembers: vi.fn(),
  addClusterHistory: vi.fn(),
  notifyUser: vi.fn(),
}))

vi.mock('../../lib/gd-utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/gd-utils.js')>()
  return {
    ...actual,
    getClusterMembers: (...args: unknown[]) => helpers.getClusterMembers(...args),
    addClusterHistory: (...args: unknown[]) => helpers.addClusterHistory(...args),
    notifyUser: (...args: unknown[]) => helpers.notifyUser(...args),
  }
})

import { adminGetCluster, adminUpdateCluster } from '../gd-admin-clusters.js'
import type { GdclusterDeps } from '../../index.js'

const { mockExecuteTakeFirst, mockExecute, setupMocks, resetMocks, setupCommonResponses } = apiDbMocks

const WALLET = '0x9994567890123456789012345678901234567890'
const INITIATOR_CHURCH = 20

const CLUSTER = {
  id: 3, name: 'Esperanza', pseudonym: null, code: 'ABC123', country_id: 1,
  status: 'active', initiator_church_id: INITIATOR_CHURCH,
  gd_requested_at: new Date('2026-10-27T12:00:00Z'), gd_sent_at: null,
  gd_response: null, gd_contact_email: null,
}

const CHURCH = { id: INITIATOR_CHURCH, name: 'Iglesia iniciadora', country_id: 1 }

function deps(overrides: Record<string, any> = {}): any {
  return {
    db: () => new apiDbMocks.MockKysely(),
    authenticateAdmin: vi.fn().mockResolvedValue({ usuario_id: 9, billetera: WALLET }),
    ...overrides,
  }
}

function putRequest(body: any): NextRequest {
  return new NextRequest(`http://localhost/api/admin/clusters/3?wallet=${WALLET}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

describe('admin/clusters (R-#220, R-#161)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
    setupCommonResponses()
    helpers.getClusterMembers.mockResolvedValue([])
    helpers.addClusterHistory.mockResolvedValue(undefined)
    helpers.notifyUser.mockResolvedValue(undefined)
    mockExecute.mockResolvedValue([])
  })

  it('returns the detail with initiator_church, not the old leader_church', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce(CLUSTER) // clustergd
      .mockResolvedValueOnce(CHURCH) // iglesia iniciadora

    const res = await adminGetCluster(
      deps() as GdclusterDeps,
      new NextRequest(`http://localhost/api/admin/clusters/3?wallet=${WALLET}`),
      { id: '3' },
    )
    expect(res.status).toBe(200)
    const { cluster } = await res.json()
    expect(cluster.initiator_church).toEqual(CHURCH)
    expect(cluster).not.toHaveProperty('leader_church')
  })

  it('refuses GD data when the cluster has not requested the presentation', async () => {
    mockExecuteTakeFirst.mockResolvedValueOnce({ ...CLUSTER, gd_requested_at: null })

    const res = await adminUpdateCluster(
      deps() as GdclusterDeps,
      putRequest({ gdSent: true }),
      { id: '3' },
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/has not requested/i)
    expect(mockExecute).not.toHaveBeenCalled()
    expect(helpers.notifyUser).not.toHaveBeenCalled()
  })

  it('records the answer and notifies the initiator in their language', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce(CLUSTER) // clustergd
      .mockResolvedValueOnce({ usuario_id: 7, idioma: 'es' }) // pastor iniciador

    const res = await adminUpdateCluster(
      deps() as GdclusterDeps,
      putRequest({ gdResponse: 'Nos vemos en noviembre.', gdContactEmail: 'gd@example.org' }),
      { id: '3' },
    )
    expect(res.status).toBe(200)

    expect(helpers.addClusterHistory).toHaveBeenCalledWith(
      expect.anything(), 3, 'gd_presentation_response', null, 'Nos vemos en noviembre.', 9,
    )
    expect(helpers.notifyUser).toHaveBeenCalledWith(
      expect.anything(),
      7,
      'gd_presentation',
      'Global Disciples respondió',
      expect.stringMatching(/respuesta y el correo/i),
      '/es/cluster/3',
    )
    // update + userevent de la respuesta + userevent del admin
    expect(mockExecute).toHaveBeenCalledTimes(3)
  })

  it('marks the email as sent only once', async () => {
    mockExecuteTakeFirst.mockResolvedValueOnce({ ...CLUSTER, gd_sent_at: new Date() })

    const res = await adminUpdateCluster(
      deps() as GdclusterDeps,
      putRequest({ gdSent: true }),
      { id: '3' },
    )
    expect(res.status).toBe(200)
    expect(helpers.addClusterHistory).not.toHaveBeenCalledWith(
      expect.anything(), 3, 'gd_presentation_sent', expect.anything(), expect.anything(), expect.anything(),
    )
  })
})
