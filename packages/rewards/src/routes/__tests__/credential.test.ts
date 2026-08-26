import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { apiDbMocks } from '@pasosdejesus/m/test-utils/kysely-mocks'

import { credentialByTokenId } from '../credential'

const {
  mockExecuteTakeFirst,
  setupMocks,
  resetMocks,
  setupCommonResponses,
} = apiDbMocks

// D4 (REQ/35 §11.2): el test inyecta deps mock al handler del motor.
// `MockKysely` (apiDbMocks) queda cableado a los mock fns compartidos.
const deps: any = {
  db: () => new apiDbMocks.MockKysely(),
  authenticateUser: vi.fn(),
  recordEvent: vi.fn(),
}

describe('credentialByTokenId (motor rewards)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
    setupCommonResponses()
    mockExecuteTakeFirst.mockResolvedValue(null)
    vi.stubEnv('NEXT_PUBLIC_AUTH_URL', 'https://learn.tg')
  })

  function buildRequest(tokenId: string): NextRequest {
    return new NextRequest(`http://localhost/api/credential/${tokenId}`)
  }

  it('returns 400 when tokenId is not a number', async () => {
    const res = await credentialByTokenId(deps, buildRequest('abc'), { tokenId: 'abc' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when tokenId is zero', async () => {
    const res = await credentialByTokenId(deps, buildRequest('0'), { tokenId: '0' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when tokenId is negative', async () => {
    const res = await credentialByTokenId(deps, buildRequest('-5'), { tokenId: '-5' })
    expect(res.status).toBe(400)
  })

  it('returns 404 when token not found in cache or DB', async () => {
    mockExecuteTakeFirst.mockResolvedValue(null)
    const res = await credentialByTokenId(deps, buildRequest('99'), { tokenId: '99' })
    expect(res.status).toBe(404)
  })

  it('returns metadata from credential_metadata cache (free course)', async () => {
    mockExecuteTakeFirst.mockResolvedValue({
      token_id: 3,
      name: 'GoodDollar Basics',
      type: 'course_completion',
      site: 'learn.tg',
      is_premium: false,
      is_soulbound: true,
      image_url: 'img/credential/3.png',
    })
    const res = await credentialByTokenId(deps, buildRequest('3'), { tokenId: '3' })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.name).toBe('GoodDollar Basics')
    expect(json.image).toContain('img/credential/3.png')
    expect(json.attributes.find((a: any) => a.trait_type === 'Premium').value).toBe(false)
    expect(json.attributes.find((a: any) => a.trait_type === 'Soulbound').value).toBe(true)
    expect(res.headers.get('Cache-Control')).toContain('immutable')
  })

  it('returns metadata from credential_metadata cache (premium course)', async () => {
    mockExecuteTakeFirst.mockResolvedValue({
      token_id: 1,
      name: 'Trading Basics',
      type: 'course_completion',
      site: 'learn.tg',
      is_premium: true,
      is_soulbound: true,
      image_url: 'https://learn.tg/img/credential/1.png',
    })
    const res = await credentialByTokenId(deps, buildRequest('1'), { tokenId: '1' })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.attributes.find((a: any) => a.trait_type === 'Premium').value).toBe(true)
  })

  it('returns Course ID and external_url when course_id is in cache', async () => {
    mockExecuteTakeFirst.mockResolvedValue({
      token_id: 3,
      name: 'GoodDollar Basics',
      type: 'course_completion',
      site: 'learn.tg',
      is_premium: false,
      is_soulbound: true,
      image_url: 'img/credential/3.png',
      course_id: 10,
    })
    const res = await credentialByTokenId(deps, buildRequest('3'), { tokenId: '3' })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.attributes.find((a: any) => a.trait_type === 'Course ID').value).toBe(10)
    expect(json.external_url).toBe('https://learn.tg/en/course/10')
  })

  it('falls back to Rails table when cache miss (Spanish course)', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce(null) // no cache
      .mockResolvedValueOnce({
        id: 2,
        titulo: 'Discipulado Global',
        porPagar: 50,
        idioma: 'es',
      })
    const res = await credentialByTokenId(deps, buildRequest('2'), { tokenId: '2' })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.description).toContain('Credencial que certifica')
    expect(json.description).toContain('intransferible')
    expect(json.attributes.find((a: any) => a.trait_type === 'Premium').value).toBe(true)
    expect(json.external_url).toBeDefined()
  })

  it('returns 500 on unexpected DB error', async () => {
    mockExecuteTakeFirst.mockRejectedValueOnce(new Error('DB crash'))
    const res = await credentialByTokenId(deps, buildRequest('1'), { tokenId: '1' })
    expect(res.status).toBe(500)
  })
})
