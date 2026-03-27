import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock kysely and sql before importing scores
const { mockSqlExecute, mockSql, MockKysely } = vi.hoisted(() => {
  const mockSqlExecute = vi.fn()
  const mockSql = vi.fn(() => ({
    execute: mockSqlExecute,
    val: vi.fn((val) => val),
    as: vi.fn(() => ({})),
  }))
  const MockKysely = vi.fn(() => ({
    selectFrom: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    selectAll: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insertInto: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    updateTable: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn(),
    execute: vi.fn(),
    sql: vi.fn(() => ({ execute: mockSqlExecute })),
    fn: {
      sum: vi.fn(() => ({ as: vi.fn(() => ({})) })),
    },
  }))
  return { mockSqlExecute, mockSql, MockKysely }
})

vi.mock('kysely', () => ({
  Kysely: MockKysely,
  PostgresDialect: vi.fn(),
  sql: mockSql,
}))

import { 
  calculateDonationLearningScore, 
  addDonationToLearningScore,
  refreshUserLearningScore
} from '../scores'

const mockDb = new MockKysely()

describe('calculateDonationLearningScore', () => {
  it('should correctly calculate score for a donation', async () => {
    const score = await calculateDonationLearningScore(10)
    expect(score).toBe(22)
  })

  it('should round score to 2 decimal places', async () => {
    const score = await calculateDonationLearningScore(10.123)
    expect(score).toBe(22.27)
  })
})

describe('refreshUserLearningScore', () => {
  it('should sum transaction points and update user', async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ total_points: 100 })
    
    const usuarioUpdateMock = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({}),
    }
    mockDb.updateTable.mockReturnValueOnce(usuarioUpdateMock)
    
    const result = await refreshUserLearningScore(mockDb as any, 1)
    
    expect(mockDb.selectFrom).toHaveBeenCalledWith('transaction')
    expect(mockDb.updateTable).toHaveBeenCalledWith('usuario')
    expect(usuarioUpdateMock.set).toHaveBeenCalledWith(
      expect.objectContaining({ learningscore: 100 })
    )
    expect(result).toBe(100)
  })
})

describe('addDonationToLearningScore', () => {
  it('should call refreshUserLearningScore', async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ total_points: 50 })
    
    const usuarioUpdateMock = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({}),
    }
    mockDb.updateTable.mockReturnValueOnce(usuarioUpdateMock)
    
    const result = await addDonationToLearningScore(mockDb as any, '1', 10)
    
    expect(mockDb.selectFrom).toHaveBeenCalledWith('transaction')
    expect(result).toBe(50)
  })
})
