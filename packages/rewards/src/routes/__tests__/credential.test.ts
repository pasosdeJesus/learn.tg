import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { apiDbMocks } from '@pasosdejesus/m/test-utils/kysely-mocks'

import { credentialByTokenId, credentialByWallet } from '../credential'

const {
  mockExecuteTakeFirst,
  mockExecute,
  setupMocks,
  resetMocks,
  setupCommonResponses,
} = apiDbMocks

// D4 (https://gitlab.com/pasosdeJesus/m/-/work_items/35 §11.2): el test inyecta deps mock al handler del motor.
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

// `GET /api/credential/wallet/[wallet]` es público y lista SBTs: aplica la misma
// regla de privacidad que el perfil público
// (https://github.com/pasosdeJesus/learn.tg/issues/259 §3.2).
describe('credentialByWallet (motor rewards)', () => {
  const WALLET = '0x84272a6dd0d5fe9ea2ab28cf96e72f4f7da00c5c'

  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
    setupCommonResponses()
  })

  function buildRequest(wallet: string): NextRequest {
    return new NextRequest(`http://localhost/api/credential/wallet/${wallet}`)
  }

  it('returns 400 for a malformed wallet', async () => {
    const res = await credentialByWallet(deps, buildRequest('0xabc'), { wallet: '0xabc' })
    expect(res.status).toBe(400)
    expect(mockExecuteTakeFirst).not.toHaveBeenCalled()
  })

  it('returns 404 when the wallet has no account', async () => {
    mockExecuteTakeFirst.mockResolvedValue(null)

    const res = await credentialByWallet(deps, buildRequest(WALLET), { wallet: WALLET })

    expect(res.status).toBe(404)
  })

  it('does not query credentials at all when the owner turned publishing off', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce({ usuario_id: 191 }) // billetera
      .mockResolvedValueOnce({ mostrar_cursos_publico: false }) // dueño
      .mockResolvedValueOnce({ donationCount: 2 }) // donaciones

    const res = await credentialByWallet(deps, buildRequest(WALLET), { wallet: WALLET })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(mockExecute).not.toHaveBeenCalled()
    expect(body.sbts).toEqual([])
    expect(body.premiumSbtCount).toBe(0)
  })

  it('answers 404 (never a shorter list) when everything is hidden', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce({ usuario_id: 191 })
      .mockResolvedValueOnce({ mostrar_cursos_publico: false })
      .mockResolvedValueOnce(null) // sin donaciones

    const res = await credentialByWallet(deps, buildRequest(WALLET), { wallet: WALLET })

    expect(res.status).toBe(404)
  })

  it('lists the SBTs and the premium count when the owner publishes', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce({ usuario_id: 191 })
      .mockResolvedValueOnce({ mostrar_cursos_publico: true, mostrar_cursos_cristianos_publico: true })
      .mockResolvedValueOnce({ totalDonated: '5.00', donationCount: 2, firstDonation: '2026-09-01' })
      .mockResolvedValueOnce({ count: 1 })
    mockExecute.mockResolvedValue([
      { tokenId: 3, name: 'Global Disciples', earnedAt: '2026-09-20T10:00:00.000Z' },
    ])

    const res = await credentialByWallet(deps, buildRequest(WALLET), { wallet: WALLET })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.sbts).toHaveLength(1)
    expect(body.premiumSbtCount).toBe(1)
    // La actividad más antigua es la donación del 2026-09-01
    expect(body.firstActivity).toBe('2026-09-01')
  })
})
