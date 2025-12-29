
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { GET } from '../route'

// Hoisted mocks to avoid hoisting issues
const { MockKysely, mockExecute, mockSql } = vi.hoisted(() => {
  const mockExecute = vi.fn()
  const mockSql = vi.fn(() => ({
    as: vi.fn(() => 'total_ubi_given'),
    execute: vi.fn(),
  }))

  class MockKysely {
    selectFrom() { return this }
    select() { return this }
    groupBy() { return this }
    having() { return this }
    deleteFrom() { return { execute: mockExecute } }
    insertInto() { return { values: vi.fn(() => ({ execute: mockExecute })) } }
    destroy() { return Promise.resolve() }
    execute() { return mockExecute() }
  }

  return { MockKysely, mockExecute, mockSql }
})

vi.mock('kysely', () => ({
  Kysely: MockKysely,
  PostgresDialect: vi.fn(),
  sql: mockSql,
}))

vi.mock('pg', () => ({
  Pool: vi.fn(),
}))

vi.mock('@/.config/kysely.config.ts', () => ({
  newKyselyPostgresql: () => new MockKysely(),
}))

describe('API /api/ubi_report', () => {
  beforeAll(async () => {
    // No-op
  })

  afterAll(async () => {
    // No-op
  })

  it('should return an aggregated report of UBI transactions', async () => {
    mockExecute.mockResolvedValueOnce([
      { wallet_address: '0x123', total_ubi_given: '150' },
      { wallet_address: '0x456', total_ubi_given: '200' },
    ])

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)

    const sortedData = data.sort((a, b) => a.wallet_address.localeCompare(b.wallet_address))

    expect(sortedData).toEqual([
      { wallet_address: '0x123', total_ubi_given: '150' },
      { wallet_address: '0x456', total_ubi_given: '200' },
    ])
  })

  it('should return an empty array if no transactions exist', async () => {
    mockExecute.mockResolvedValueOnce([])

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual([])
  })
})
