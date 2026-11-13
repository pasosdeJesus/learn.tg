import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { apiDbMocks } from '@pasosdejesus/m/test-utils/kysely-mocks'

import { createCluster, updateCluster } from '../gd-cluster.js'
import type { GdclusterDeps } from '../../index.js'

// R-#299: `name` y `slug` son únicos (los índices únicos son la verdad; el API sólo da el
// motivo amable) y el pastor edita el **alias** desde `PATCH /api/cluster/[id]`, nunca el
// nombre interno.

const { mockExecuteTakeFirst, mockExecute, resetMocks, setupCommonResponses } = apiDbMocks

const WALLET = '0x1234567890123456789012345678901234567890'

const CHURCH = { id: 20, name: 'Iglesia iniciadora', country_id: 1 }
const MEMBERSHIP = { clustergd_id: 3, joined_at: new Date(), left_at: null }
const CLUSTER = {
  id: 3, name: 'Esperanza', slug: 'esp', country_id: 1,
  created_at: new Date(), initiator_church_id: 20, status: 'pending',
}

function buildDeps(): any {
  return {
    db: () => new apiDbMocks.MockKysely(),
    authenticateUser: vi.fn().mockResolvedValue({
      usuario: { id: 5, church_id: 20, nombre: 'Pastor A', idioma: 'es_CO', church_relationship: 'pastor' },
      billetera: { billetera: WALLET },
    }),
    backend: {},
  }
}

function patch(body: any): NextRequest {
  return new NextRequest('http://localhost/api/cluster/3', { method: 'PATCH', body: JSON.stringify({ walletAddress: WALLET, ...body }) })
}

function post(body: any): NextRequest {
  return new NextRequest('http://localhost/api/cluster', { method: 'POST', body: JSON.stringify({ walletAddress: WALLET, ...body }) })
}

/** Consultas previas de `createCluster` hasta la comprobación de nombre. */
function queueCreatePrelude() {
  mockExecuteTakeFirst
    .mockResolvedValueOnce(CHURCH) // getPastorChurch
    .mockResolvedValueOnce({ tipo_region: 1 }) // isType1Country
    .mockResolvedValueOnce({ id: 1 }) // premium_course_usuario
    .mockResolvedValueOnce(null) // churchCompletedCluster
    .mockResolvedValueOnce(null) // getChurchCluster
}

describe('updateCluster — public alias (R-#299)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
    setupCommonResponses()
  })

  it('changes the slug of the initiator and records it in the history', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce(CHURCH)
      .mockResolvedValueOnce(MEMBERSHIP)
      .mockResolvedValueOnce(CLUSTER)
      .mockResolvedValueOnce(null) // slug libre
    mockExecute.mockResolvedValue([])

    const res = await updateCluster(buildDeps() as GdclusterDeps, patch({ slug: 'nuevo-alias' }), { id: '3' })
    expect(res.status).toBe(200)
    expect((await res.json()).slug).toBe('nuevo-alias')
    expect(mockExecute).toHaveBeenCalledTimes(2) // update + history
  })

  it('answers 409 slug_taken with a suggestion when the alias is taken', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce(CHURCH)
      .mockResolvedValueOnce(MEMBERSHIP)
      .mockResolvedValueOnce(CLUSTER)
      .mockResolvedValueOnce({ id: 9 }) // otro clúster con ese alias

    const res = await updateCluster(buildDeps() as GdclusterDeps, patch({ slug: 'otro' }), { id: '3' })
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.code).toBe('slug_taken')
    expect(json.suggestion).toBe('otro-3')
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it('answers 400 slug_invalid', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce(CHURCH)
      .mockResolvedValueOnce(MEMBERSHIP)
      .mockResolvedValueOnce(CLUSTER)

    const res = await updateCluster(buildDeps() as GdclusterDeps, patch({ slug: 'Mal Alias' }), { id: '3' })
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('slug_invalid')
  })

  it('refuses to change the internal name from the pastor path', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce(CHURCH)
      .mockResolvedValueOnce(MEMBERSHIP)
      .mockResolvedValueOnce(CLUSTER)

    const res = await updateCluster(buildDeps() as GdclusterDeps, patch({ name: 'Otro nombre' }), { id: '3' })
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('name_not_editable')
  })
})

describe('createCluster — name and slug uniques (R-#299)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
    setupCommonResponses()
  })

  it('answers 409 name_taken for an existing name (case and spaces ignored)', async () => {
    queueCreatePrelude()
    mockExecuteTakeFirst.mockResolvedValueOnce({ id: 4 }) // nombre ya usado

    const res = await createCluster(buildDeps() as GdclusterDeps, post({ name: '  esperanza  ' }))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('name_taken')
  })

  it('answers 409 slug_taken for a typed alias that is taken', async () => {
    queueCreatePrelude()
    mockExecuteTakeFirst
      .mockResolvedValueOnce(null) // nombre libre
      .mockResolvedValueOnce({ id: 9 }) // alias tomado

    const res = await createCluster(buildDeps() as GdclusterDeps, post({ name: 'Esperanza', slug: 'esp' }))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('slug_taken')
  })

  it('answers 400 slug_invalid for a typed alias with an invalid shape', async () => {
    queueCreatePrelude()
    mockExecuteTakeFirst.mockResolvedValueOnce(null) // nombre libre

    const res = await createCluster(buildDeps() as GdclusterDeps, post({ name: 'Esperanza', slug: '-esp-' }))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('slug_invalid')
  })
})
