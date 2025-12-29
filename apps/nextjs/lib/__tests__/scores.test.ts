import { updateUserAndCoursePoints } from '../scores'
import { vi, describe, beforeEach, it, expect } from 'vitest'

// More granular mocks for each chain
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

const mockSql: any = {
  execute: vi.fn(),
  as: vi.fn(() => mockSql),
}

const mockFn: any = {
  countAll: vi.fn(() => ({
    as: vi.fn(() => mockFn),
  })),
  sum: vi.fn(() => ({
    as: vi.fn(() => mockFn),
  })),
}

// Main DB mock
const mockDb: any = {
  selectFrom: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  selectAll: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  execute: vi.fn(),
  executeTakeFirst: vi.fn(),
  insertInto: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returningAll: vi.fn().mockReturnThis(),
  executeTakeFirstOrThrow: vi.fn(),
  updateTable: vi.fn((table: string) => {
    if (table === 'course_usuario') {
      return courseUsuarioUpdateMock
    }
    if (table === 'usuario') {
      return usuarioUpdateMock
    }
    return {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({}),
    }
  }),
  fn: mockFn,
}

vi.mock('kysely', () => ({
  sql: vi.fn(() => mockSql),
}))

describe('updateUserAndCoursePoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

    mockSql.execute.mockResolvedValue(guidesUsuario)
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

    mockSql.execute.mockResolvedValue(guidesUsuario)
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

    mockSql.execute.mockResolvedValue(guidesUsuario)
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

    mockSql.execute.mockResolvedValue(guidesUsuario)
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
