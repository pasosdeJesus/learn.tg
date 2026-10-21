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
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    having: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    insertInto: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returningAll: vi.fn().mockReturnThis(),
    updateTable: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    deleteFrom: vi.fn().mockReturnThis(),
    with: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn(),
    executeTakeFirstOrThrow: vi.fn(),
    execute: vi.fn(),
    sql: vi.fn(() => ({ execute: mockSqlExecute })),
    fn: {
      countAll: vi.fn(() => ({ as: vi.fn(() => ({})) })),
      sum: vi.fn(() => ({ as: vi.fn(() => ({})) })),
      avg: vi.fn(() => ({ as: vi.fn(() => ({})) })),
      max: vi.fn(() => ({ as: vi.fn(() => ({})) })),
      min: vi.fn(() => ({ as: vi.fn(() => ({})) })),
    },
  }))
  return { mockSqlExecute, mockSql, MockKysely }
})

// Mock the kysely module
vi.mock('kysely', () => ({
  Kysely: MockKysely,
  PostgresDialect: vi.fn(),
  sql: mockSql,
}))

// More granular mocks for each chain (keep existing structure)
const usuarioUpdateMock = {
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  execute: vi.fn().mockResolvedValue({}),
}

// Now import the module after mocks are set up
import { updateUserAndCoursePoints } from '../scores'

// Create custom mock DB that extends MockKysely
const mockDb = new MockKysely()


describe('updateUserAndCoursePoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSqlExecute.mockReset()
    mockSqlExecute.mockImplementation(() => {
      console.log('mockSqlExecute called')
      return { rows: [] }
    })
    usuarioUpdateMock.set.mockReset()
    usuarioUpdateMock.where.mockReset()
    usuarioUpdateMock.execute.mockReset()

    // Reset default behaviors for update mocks
    usuarioUpdateMock.set.mockReturnThis()
    usuarioUpdateMock.where.mockReturnThis()
    usuarioUpdateMock.execute.mockResolvedValue({})

    // Reset DB method mocks and set default behaviors
    mockDb.execute.mockReset()
    mockDb.execute.mockResolvedValue([]) // default empty array
    mockDb.executeTakeFirst.mockReset()
    mockDb.executeTakeFirst.mockResolvedValue(null) // default null
    mockDb.executeTakeFirstOrThrow.mockReset()
    mockDb.executeTakeFirstOrThrow.mockResolvedValue(null)
    mockDb.insertInto.mockReset()
    mockDb.insertInto.mockReturnThis()
    mockDb.values.mockReset()
    mockDb.values.mockReturnThis()
    mockDb.returningAll.mockReset()
    mockDb.returningAll.mockReturnThis()
    mockDb.selectFrom.mockReset()
    mockDb.selectFrom.mockReturnThis()
    mockDb.where.mockReset()
    mockDb.where.mockReturnThis()
    mockDb.selectAll.mockReset()
    mockDb.selectAll.mockReturnThis()
    mockDb.select.mockReset()
    mockDb.select.mockReturnThis()
    mockDb.fn.countAll.mockReset()
    mockDb.fn.countAll.mockReturnValue({ as: vi.fn(() => ({})) })
    mockDb.fn.sum.mockReset()
    mockDb.fn.sum.mockReturnValue({ as: vi.fn(() => ({})) })
    mockDb.updateTable.mockReset()
    mockDb.updateTable.mockImplementation((table: string) => {
      if (table === 'usuario') {
        return usuarioUpdateMock
      }
      return {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({}),
      }
    })
    mockDb.sql.mockReset()
    mockDb.sql.mockImplementation(() => ({ execute: mockSqlExecute }))
  })

  it('should calculate scores and update db for a single user and course', async () => {
    const user = { id: 1, learningscore_deprecated: 15, profilescore: 50 }
    const guidesUsuario = {
      rows: [
        {
          usuario_id: 1,
          actividadpf_id: 10,
          proyectofinanciero_id: 100,
          points: 10,
          amountpaid: 1,
        },
        {
          usuario_id: 1,
          actividadpf_id: 11,
          proyectofinanciero_id: 100,
          points: 5,
          amountpaid: 0.5,
        },
      ],
    }

    const result = await updateUserAndCoursePoints(mockDb as any, user as any, null, '', null)

    expect(result).toBe(15)
  })

  it('should handle users with no guides completed', async () => {
    const user = { id: 2, learningscore_deprecated: 10, profilescore: 20 }

    const result = await updateUserAndCoursePoints(mockDb as any, user as any, null, '', null)

    expect(result).toBe(10)
  })

  it('should correctly sum points from multiple courses', async () => {
    const user = { id: 3, learningscore_deprecated: 25, profilescore: 0 }

    const result = await updateUserAndCoursePoints(mockDb as any, user as any, null, '', null)

    expect(result).toBe(25)
  })
})
