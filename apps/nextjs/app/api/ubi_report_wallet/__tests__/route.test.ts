
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { GET } from '../route'

// Hoisted mocks to avoid hoisting issues
const { MockKysely, mockExecute } = vi.hoisted(() => {
  const mockExecute = vi.fn()

  class MockKysely {
    selectFrom() { return this }
    select() { return this }
    where() { return this }
    orderBy() { return this }
    deleteFrom() { return { execute: mockExecute } }
    insertInto() { return { values: vi.fn(() => ({ execute: mockExecute })) } }
    destroy() { return Promise.resolve() }
    execute() { return mockExecute() }
  }

  return { MockKysely, mockExecute }
})

vi.mock('kysely', () => ({
  Kysely: MockKysely,
  PostgresDialect: vi.fn(),
  sql: vi.fn(),
}))

vi.mock('pg', () => ({
  Pool: vi.fn(),
}))

vi.mock('@/.config/kysely.config.ts', () => ({
  newKyselyPostgresql: () => new MockKysely(),
}))

describe('API /api/ubi_report_wallet', () => {
  beforeAll(async () => {
    // No-op, mocks handle everything
  })

  afterAll(async () => {
    // No-op
  })

  it('should return transactions for a specific wallet, ordered by date desc', async () => {
    // Mock data ordered by date desc (most recent first)
    mockExecute.mockResolvedValueOnce([
      { tx: '0xb', amountCelo: '50', date_of_transaction: new Date(Date.now() + 1000) },
      { tx: '0xa', amountCelo: '100', date_of_transaction: new Date() },
    ])

    const url = new URL('http://localhost/api/ubi_report_wallet?wallet=0xAbC123AbC123AbC123AbC123AbC123AbC123AbC1')
    const request = new Request(url.toString())

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.length).toBe(2)
    expect(data[0].tx).toBe('0xb') // Most recent
    expect(data[1].tx).toBe('0xa')
    expect(data[0].amountCelo).toBe('50')
  })

  it('should return 400 for an invalid wallet address', async () => {
    // Zod validation will fail, no DB call needed
    const url = new URL('http://localhost/api/ubi_report_wallet?wallet=invalid-wallet')
    const request = new Request(url.toString())

    const response = await GET(request)
    const text = await response.text()

    expect(response.status).toBe(400)
    expect(text).toBe('Invalid wallet address')
  })

  it('should return an empty array for a wallet with no transactions', async () => {
    mockExecute.mockResolvedValueOnce([])

    const url = new URL('http://localhost/api/ubi_report_wallet?wallet=0x1111111111111111111111111111111111111111')
    const request = new Request(url.toString())

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual([])
  })
})
