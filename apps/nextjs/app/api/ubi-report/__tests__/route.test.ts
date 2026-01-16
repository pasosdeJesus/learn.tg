
import { describe, it, expect, afterEach, vi } from 'vitest'
import { GET } from '../route'

// 1. Mock the DB client and execute function
const { dbMock, mockExecute } = vi.hoisted(() => {
  const mockExecute = vi.fn()
  const dbMock = {
    selectFrom: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    having: vi.fn().mockReturnThis(),
    execute: mockExecute,
  }
  return { dbMock, mockExecute }
})

// 2. Mock the modules
vi.mock('@/.config/kysely.config.ts', () => ({
  newKyselyPostgresql: () => dbMock,
}))

vi.mock('kysely', async (importOriginal) => {
    const actual = await importOriginal()
    // Mock only Kysely and PostgresDialect, keep sql as is if possible or simplify
    return {
        ...actual,
        Kysely: vi.fn(),
        PostgresDialect: vi.fn(),
        sql: vi.fn().mockImplementation((strings, ...values) => {
            // A simplified mock for the sql tag that returns an object with an 'as' method
            return {
                as: vi.fn().mockReturnValue({})
            };
        }),
    }
})

vi.mock('pg', () => ({
  Pool: vi.fn(() => ({
    connect: vi.fn(),
    end: vi.fn(),
  })),
}))

describe('API /api/ubi-report', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should return an aggregated report of UBI transactions', async () => {
    const mockReport = [
      { wallet_address: '0x123', total_ubi_given: '150' },
      { wallet_address: '0x456', total_ubi_given: '200' },
    ]
    mockExecute.mockResolvedValueOnce(mockReport)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    // The route returns an object { report, total }
    expect(data).toHaveProperty('report')
    expect(data).toHaveProperty('total')

    const sortedData = data.report.sort((a: { wallet_address: string }, b: { wallet_address: string }) =>
      a.wallet_address.localeCompare(b.wallet_address)
    )

    expect(sortedData).toEqual(mockReport)
    expect(data.total).toBe('350') // 150 + 200
  })

  it('should return an empty array if no transactions exist', async () => {
    mockExecute.mockResolvedValueOnce([])

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.report).toEqual([])
    expect(data.total).toBe('0')
  })

  it('should handle database errors gracefully', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB Error'))

    const response = await GET()

    expect(response.status).toBe(500)
    const text = await response.text()
    expect(text).toBe('Internal Server Error')
  })
})
