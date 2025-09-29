import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock de pg y kysely para evitar conexión real
vi.mock('pg', () => ({ Pool: vi.fn(() => ({})) }))
let mockRow: any = undefined
vi.mock('kysely', () => {
  class DummyKysely {
    selectFrom() { return this }
    where() { return this }
    selectAll() { return this }
    executeTakeFirst() { return Promise.resolve(mockRow) }
  }
  return { Kysely: DummyKysely, PostgresDialect: class {} }
})

// Mock viem y contrato
vi.mock('viem', () => ({
  privateKeyToAccount: () => ({ address: '0xABC' }),
  createPublicClient: () => ({}),
  createWalletClient: () => ({}),
  getContract: () => ({
    read: {
      getVault: () => Promise.resolve({ exists: false }),
      studentCanSubmit: () => Promise.resolve(false)
    }
  }),
  http: () => ({}),
}))
vi.mock('viem/chains', () => ({ celo: {}, celoSepolia: {} }))

// Importar después de mocks
import { GET } from '../route'

function makeReq(url: string) {
  return new NextRequest(new Request(url))
}

describe('API /api/scholarship', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_AUTH_URL = 'https://learn.tg'
    process.env.NEXT_PUBLIC_DEPLOYED_AT = '0x0000000000000000000000000000000000000001'
    process.env.NEXT_PUBLIC_PRIVATE_KEY = '0x123'
    process.env.NEXT_PUBLIC_RPC_URL = 'https://rpc.test'
    process.env.DB_HOST = 'localhost'
    process.env.DB_NAME = 'db'
    process.env.DB_USER = 'user'
    process.env.DB_PASSWORD = 'pass'
  })

  it('retorna mensaje de error cuando falta courseId', async () => {
    const req = makeReq('http://localhost:3000/api/scholarship?walletAddress=0xabc&token=t1')
    const res = await GET(req)
    const json: any = await res.json()
    expect(res.status).toBe(200)
    expect(json.message).toMatch(/Missing courseId/)
    expect(json.amountPerGuide).toBe(0)
  })

  it('agrega mensaje de token mismatch cuando token difiere', async () => {
    mockRow = { token: 'DIFFERENT' }
    const req = makeReq('http://localhost:3000/api/scholarship?courseId=1&walletAddress=0xabc&token=tok1')
    const res = await GET(req)
    const json: any = await res.json()
    expect(res.status).toBe(200)
    expect(json.message).toMatch(/Token stored/)
    mockRow = undefined
  })
})
