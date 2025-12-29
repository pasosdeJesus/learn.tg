import { describe, it, expect, beforeEach, vi, beforeAll, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockExecuteTakeFirst = vi.fn()

class MockKysely {
  selectFrom() { return this }
  where() { return this }
  selectAll() { return this }
  executeTakeFirst() { return mockExecuteTakeFirst() }
}

vi.mock('kysely', () => ({
  Kysely: MockKysely,
  PostgresDialect: vi.fn(),
}))

vi.mock('pg', () => ({
  Pool: vi.fn(),
}))

vi.mock('@/.config/kysely.config', () => ({
  newKyselyPostgresql: () => new MockKysely(),
}))

const mockReadContract = vi.fn()
const mockWriteContract = vi.fn()
const mockWaitForTransactionReceipt = vi.fn()

vi.mock('viem', async () => {
  const actual = await vi.importActual('viem')
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      readContract: mockReadContract,
      waitForTransactionReceipt: mockWaitForTransactionReceipt,
    })),
    createWalletClient: vi.fn(() => ({
      writeContract: mockWriteContract,
    })),
    privateKeyToAccount: vi.fn(() => ({ address: '0xmockbackendwallet'})),
    http: vi.fn(),
  }
})

let POST: any

describe('API /api/claim-celo-ubi', () => {
  beforeAll(async () => {
    const route = await import('../route')
    POST = route.POST
  })

  beforeEach(() => {
    vi.restoreAllMocks()
    process.env.NEXT_PUBLIC_RPC_URL = 'https://forno.celo.org'
    process.env.NEXT_PUBLIC_CELOUBI_ADDRESS = '0x765DE816845861e75A25fCA122bb6898B8B1282a'
    process.env.PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
    process.env.NEXT_PUBLIC_AUTH_URL = 'https://learn.tg'
  })

  it('POST con walletAddress y token válidos reclama la beca exitosamente', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce({ billetera: '0x123', usuario_id: 1, token: 'VALID_TOKEN' })
      .mockResolvedValueOnce({ id: 1, profilescore: 60 })
    mockReadContract
      .mockResolvedValueOnce(BigInt(Math.floor(Date.now() / 1000) - 3601)) // lastClaim
      .mockResolvedValueOnce(BigInt(3600)) // cooldown
    mockWriteContract.mockResolvedValue('0xmocktxhash')
    mockWaitForTransactionReceipt.mockResolvedValue({ status: 'success' })

    const body = { walletAddress: '0x123', token: 'VALID_TOKEN' };
    const req = new NextRequest('http://localhost/api/claim-celo-ubi', {
      method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.message).toBe('Claim successful!')
    expect(data.transactionHash).toBe('0xmocktxhash')
    expect(mockWriteContract).toHaveBeenCalled()
  })

  it('POST con token inválido devuelve error 401', async () => {
    mockExecuteTakeFirst.mockResolvedValueOnce({ billetera: '0x123', usuario_id: 1, token: 'DIFFERENT_TOKEN' })

    const body = { walletAddress: '0x123', token: 'INVALID_TOKEN' };
    const req = new NextRequest('http://localhost/api/claim-celo-ubi', {
      method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.message).toMatch(/doesn't match/i)
  })

  it('POST con profilescore bajo devuelve error 403', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce({ billetera: '0x123', usuario_id: 1, token: 'VALID_TOKEN' })
      .mockResolvedValueOnce({ id: 1, profilescore: 40 })

    const body = { walletAddress: '0x123', token: 'VALID_TOKEN' };
    const req = new NextRequest('http://localhost/api/claim-celo-ubi', {
      method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.message).toMatch(/Profile score must be at least/i)
  })

  it('POST durante el periodo de cooldown devuelve error 429', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce({ billetera: '0x123', usuario_id: 1, token: 'VALID_TOKEN' })
      .mockResolvedValueOnce({ id: 1, profilescore: 60 })
    mockReadContract
      .mockResolvedValueOnce(BigInt(Math.floor(Date.now() / 1000) - 1800)) // lastClaim (30 mins ago)
      .mockResolvedValueOnce(BigInt(3600)) // cooldown (1 hour)

    const body = { walletAddress: '0x123', token: 'VALID_TOKEN' };
    const req = new NextRequest('http://localhost/api/claim-celo-ubi', {
      method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(429)
    expect(data.message).toBe('Cooldown period not over')
  })
})
