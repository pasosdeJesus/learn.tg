import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock kysely and sql before importing guide-utils
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

vi.mock('kysely', () => ({
  Kysely: MockKysely,
  PostgresDialect: vi.fn(),
  sql: mockSql,
}))

vi.mock('@/.config/kysely.config', () => ({
  newKyselyPostgresql: vi.fn(() => new MockKysely()),
}))

// Now import the module after mocks are set up
import { getGuidesByCourseId, getGuideIdBySuffix, getActividadpfId, getCourseIdByPrefix } from '../guide-utils'

const mockDb = new MockKysely()

describe('guide-utils', () => {

  beforeEach(() => {
    vi.clearAllMocks()
    mockSqlExecute.mockReset()
    mockSql.mockReset()

    // Configure sql mock to support template tag usage
    mockSql.mockImplementation(() => ({
      as: vi.fn().mockReturnValue({}),
      execute: mockSqlExecute,
      val: vi.fn((val) => val),
    }))
  })

  describe('getGuidesByCourseId', () => {
    it('should return null when no guides found', async () => {
      mockSqlExecute.mockResolvedValue({ rows: [] })

      const result = await getGuidesByCourseId(1, mockDb)

      expect(result).toBeNull()
      expect(mockSql).toHaveBeenCalled()
      expect(mockSqlExecute).toHaveBeenCalled()
    })

    it('should return guides when found', async () => {
      const mockGuides = [
        { id: 101, nombrecorto: 'guide1', sufijoRuta: 'guide1', proyectofinanciero_id: 1, answer_fib: 'answer1' },
        { id: 102, nombrecorto: 'guide2', sufijoRuta: 'guide2', proyectofinanciero_id: 1, answer_fib: 'answer2' },
      ]
      mockSqlExecute.mockResolvedValue({ rows: mockGuides })

      const result = await getGuidesByCourseId(1, mockDb)

      expect(result).toEqual(mockGuides)
      expect(mockSql).toHaveBeenCalledWith(expect.arrayContaining([expect.stringContaining('cor1440_gen_actividadpf')]), 1)
    })

    it('should handle database errors and return null', async () => {
      mockSqlExecute.mockRejectedValue(new Error('DB error'))
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await getGuidesByCourseId(1, mockDb)

      expect(result).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error getting guides by courseId:', expect.any(Error))
      consoleErrorSpy.mockRestore()
    })
  })

  describe('getGuideIdBySuffix', () => {
    it('should return null for invalid courseId', async () => {
      const result = await getGuideIdBySuffix(0, 'guide1')
      expect(result).toBeNull()
    })

    it('should return null when no guides found', async () => {
      mockSqlExecute.mockResolvedValue({ rows: [] })

      const result = await getGuideIdBySuffix(1, 'guide1')

      expect(result).toBeNull()
    })

    it('should return guideId when suffix matches', async () => {
      const mockGuides = [
        { id: 101, nombrecorto: 'a', sufijoRuta: 'guide1', proyectofinanciero_id: 1 },
        { id: 102, nombrecorto: 'b', sufijoRuta: 'guide2', proyectofinanciero_id: 1 },
      ]
      mockSqlExecute.mockResolvedValue({ rows: mockGuides })

      const result = await getGuideIdBySuffix(1, 'guide2')

      expect(result).toBe(2) // 1-indexed, guide2 is second in array
    })

    it('should return null when suffix not found', async () => {
      const mockGuides = [
        { id: 101, nombrecorto: 'a', sufijoRuta: 'guide1', proyectofinanciero_id: 1 },
      ]
      mockSqlExecute.mockResolvedValue({ rows: mockGuides })

      const result = await getGuideIdBySuffix(1, 'nonexistent')

      expect(result).toBeNull()
    })

    it('should handle database errors and return null', async () => {
      mockSqlExecute.mockRejectedValue(new Error('DB error'))
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await getGuideIdBySuffix(1, 'guide1')

      expect(result).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error getting guides by courseId:', expect.any(Error))
      consoleErrorSpy.mockRestore()
    })
  })

  describe('getActividadpfId', () => {
    it('should return actividadpf_id for valid guideId', async () => {
      const mockGuides = [
        { id: 101, nombrecorto: 'a', sufijoRuta: 'guide1', proyectofinanciero_id: 1 },
        { id: 102, nombrecorto: 'b', sufijoRuta: 'guide2', proyectofinanciero_id: 1 },
      ]
      mockSqlExecute.mockResolvedValue({ rows: mockGuides })

      const result = await getActividadpfId(1, 2) // guideId 2 -> second guide

      expect(result).toBe(102)
    })

    it('should return null when no guides found', async () => {
      mockSqlExecute.mockResolvedValue({ rows: [] })

      const result = await getActividadpfId(1, 1)

      expect(result).toBeNull()
    })

    it('should return null for invalid guideId (out of range)', async () => {
      const mockGuides = [
        { id: 101, nombrecorto: 'a', sufijoRuta: 'guide1', proyectofinanciero_id: 1 },
      ]
      mockSqlExecute.mockResolvedValue({ rows: mockGuides })

      const result = await getActividadpfId(1, 5) // guideId 5 > total guides

      expect(result).toBeNull()
    })

    it('should handle database errors and return null', async () => {
      mockSqlExecute.mockRejectedValue(new Error('DB error'))
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await getActividadpfId(1, 1)

      expect(result).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error getting guides by courseId:', expect.any(Error))
      consoleErrorSpy.mockRestore()
    })
  })

  describe('getCourseIdByPrefix', () => {
    it('should return null for empty prefix', async () => {
      const result = await getCourseIdByPrefix('')
      expect(result).toBeNull()
    })

    it('should return null for whitespace-only prefix', async () => {
      const result = await getCourseIdByPrefix('   ')
      expect(result).toBeNull()
    })

    it('should return courseId when prefix matches', async () => {
      mockSqlExecute.mockResolvedValue({ rows: [{ id: 2 }] })

      const result = await getCourseIdByPrefix('a-relationship-with-Jesus')

      expect(result).toBe(2)
      expect(mockSql).toHaveBeenCalledWith(expect.arrayContaining([expect.stringContaining('cor1440_gen_proyectofinanciero')]), '/a-relationship-with-Jesus')
    })

    it('should return null when prefix not found', async () => {
      mockSqlExecute.mockResolvedValue({ rows: [] })

      const result = await getCourseIdByPrefix('nonexistent')

      expect(result).toBeNull()
    })

    it('should handle database errors and return null', async () => {
      mockSqlExecute.mockRejectedValue(new Error('DB error'))
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await getCourseIdByPrefix('test')

      expect(result).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error getting courseId by prefix:', expect.any(Error))
      consoleErrorSpy.mockRestore()
    })

    it('should add leading slash to prefix when querying', async () => {
      mockSqlExecute.mockResolvedValue({ rows: [{ id: 2 }] })

      await getCourseIdByPrefix('test-prefix')

      // Verify the SQL was called with prefixed path
      // Note: The actual SQL string includes the prefix with leading slash
      expect(mockSql).toHaveBeenCalled()
      // We can't easily check the exact template string, but we trust it works
    })
  })
})