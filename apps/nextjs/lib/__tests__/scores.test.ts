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
const courseUsuarioUpdateMock = {
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  execute: vi.fn().mockResolvedValue({}),
}

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
    courseUsuarioUpdateMock.set.mockReset()
    courseUsuarioUpdateMock.where.mockReset()
    courseUsuarioUpdateMock.execute.mockReset()
    usuarioUpdateMock.set.mockReset()
    usuarioUpdateMock.where.mockReset()
    usuarioUpdateMock.execute.mockReset()

    // Reset default behaviors for update mocks
    courseUsuarioUpdateMock.set.mockReturnThis()
    courseUsuarioUpdateMock.where.mockReturnThis()
    courseUsuarioUpdateMock.execute.mockResolvedValue({})
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
      if (table === 'course_usuario') {
        return courseUsuarioUpdateMock
      } else if (table === 'usuario') {
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
    const user = { id: 1, learningscore: 0, profilescore: 50 }
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
    const totalGuidesInCourse = { count: 4 } // 2 completed out of 4
    const totalCoursePoints = { total_points: 0 }

    mockSqlExecute.mockResolvedValue(guidesUsuario)
    mockDb.execute.mockResolvedValueOnce([]) // Course not found initially
    mockDb.executeTakeFirstOrThrow.mockResolvedValueOnce({ id: 99 }) // Mock the insert
    mockDb.executeTakeFirst
      .mockResolvedValueOnce(totalGuidesInCourse) // total guides
      .mockResolvedValueOnce({ total_points: 15 }) // total guide points
      .mockResolvedValueOnce(totalCoursePoints) // total course points

    await updateUserAndCoursePoints(mockDb as any, user as any, null)

    expect(mockDb.insertInto).toHaveBeenCalledWith('course_usuario')
    expect(mockDb.values).toHaveBeenCalledWith(expect.any(Object))
    expect(mockDb.executeTakeFirstOrThrow).toHaveBeenCalled()

    expect(mockDb.updateTable).toHaveBeenCalledWith('course_usuario')
    expect(courseUsuarioUpdateMock.set).toHaveBeenCalledWith(
      expect.objectContaining({
        guidespoints: 15,
        amountscholarship: 1.5,
        percentagecompleted: 50,
      }),
    )

    expect(mockDb.updateTable).toHaveBeenCalledWith('usuario')
    expect(usuarioUpdateMock.set).toHaveBeenCalledWith(
      expect.objectContaining({ learningscore: 15 }),
    )
  })

  it('should handle users with no guides completed', async () => {
    const user = { id: 2, learningscore: 10, profilescore: 20 }
    const guidesUsuario = { rows: [] }

    mockSqlExecute.mockResolvedValue(guidesUsuario)
    mockDb.executeTakeFirst
      .mockResolvedValueOnce({ total_points: 0 }) // No guide points
      .mockResolvedValueOnce({ total_points: 0 }) // No course points

    await updateUserAndCoursePoints(mockDb as any, user as any, null)

    expect(mockDb.insertInto).not.toHaveBeenCalled()

    expect(mockDb.updateTable).toHaveBeenCalledWith('usuario')
    expect(usuarioUpdateMock.set).toHaveBeenCalledWith(
      expect.objectContaining({ learningscore: 0 }),
    )
  })

  it('should correctly sum points from multiple courses', async () => {
    const user = { id: 3, learningscore: 0, profilescore: 0 }
    const guidesUsuario = {
      rows: [
        { proyectofinanciero_id: 1, points: 10, amountpaid: 1 },
        { proyectofinanciero_id: 1, points: 10, amountpaid: 1 },
        { proyectofinanciero_id: 2, points: 5, amountpaid: 0.5 },
      ],
    }

    mockSqlExecute.mockResolvedValue(guidesUsuario)
    mockDb.execute.mockResolvedValue([]) // No existing course_usuario
    mockDb.executeTakeFirstOrThrow
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce({ id: 2 })
    mockDb.executeTakeFirst
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ total_points: 25 })
      .mockResolvedValueOnce({ total_points: 0 })

    await updateUserAndCoursePoints(mockDb as any, user as any, null)

    expect(courseUsuarioUpdateMock.set).toHaveBeenCalledWith(
      expect.objectContaining({ guidespoints: 20, percentagecompleted: 100 }),
    )
    expect(courseUsuarioUpdateMock.set).toHaveBeenCalledWith(
      expect.objectContaining({ guidespoints: 5, percentagecompleted: 100 }),
    )
    expect(usuarioUpdateMock.set).toHaveBeenCalledWith(
      expect.objectContaining({ learningscore: 25 }),
    )
  })

  it('should update existing course_usuario record if it exists', async () => {
    const user = { id: 1, learningscore: 0, profilescore: 50 }
    const guidesUsuario = {
      rows: [
        { usuario_id: 1, proyectofinanciero_id: 100, points: 20, amountpaid: 2 },
        { usuario_id: 1, proyectofinanciero_id: 100, points: 10, amountpaid: 1 },
      ],
    }
    const existingCourseUser = [
      {
        id: 5,
        proyectofinanciero_id: 100,
        usuario_id: 1,
        guidespoints: 15,
        amountscholarship: 1.5,
        percentagecompleted: 50,
      },
    ]
    const totalGuidesInCourse = { count: 4 }

    mockSqlExecute.mockResolvedValue(guidesUsuario)
    mockDb.execute.mockResolvedValueOnce(existingCourseUser)
    mockDb.executeTakeFirst
      .mockResolvedValueOnce(totalGuidesInCourse)
      .mockResolvedValueOnce({ total_points: 30 })
      .mockResolvedValueOnce({ total_points: 0 })

    await updateUserAndCoursePoints(mockDb as any, user as any, null)

    expect(mockDb.insertInto).not.toHaveBeenCalled()
    expect(mockDb.updateTable).toHaveBeenCalledWith('course_usuario')
    expect(courseUsuarioUpdateMock.set).toHaveBeenCalledWith(
      expect.objectContaining({
        guidespoints: 30,
        amountscholarship: 3,
        percentagecompleted: 50,
      }),
    )
    expect(courseUsuarioUpdateMock.where).toHaveBeenNthCalledWith(1, 'usuario_id', '=', 1)
    expect(courseUsuarioUpdateMock.where).toHaveBeenNthCalledWith(2, 'proyectofinanciero_id', '=', 100)

    expect(mockDb.updateTable).toHaveBeenCalledWith('usuario')
    expect(usuarioUpdateMock.set).toHaveBeenCalledWith(
      expect.objectContaining({ learningscore: 30 }),
    )
    expect(usuarioUpdateMock.where).toHaveBeenCalledWith('id', '=', 1)
  })
})
