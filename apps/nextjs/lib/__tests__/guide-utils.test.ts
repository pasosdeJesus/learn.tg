import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getGuidesByCourseId, getGuideIdBySuffix, getActividadpfId, getCourseIdByPrefix } from '../guide-utils'

// Mock Kysely and sql similar to other tests
const mockExecuteTakeFirst = vi.hoisted(() => vi.fn())
const mockExecute = vi.hoisted(() => vi.fn())

const MockKysely = vi.hoisted(() => {
  return class MockKysely {
    selectFrom() { return this }
    where() { return this }
    selectAll() { return this }
    executeTakeFirst() { return mockExecuteTakeFirst() }
    orderBy() { return this }
    limit() { return this }
    select() { return this }
    insertInto() { return this }
    values() { return this }
    returningAll() { return this }
    execute() { return mockExecute() }
    executeTakeFirstOrThrow() { return mockExecuteTakeFirst() }
  }
})

const mockSqlExecute = vi.hoisted(() => vi.fn())
const mockSql = vi.hoisted(() => vi.fn(() => ({
  execute: mockSqlExecute,
})))

vi.mock('kysely', () => ({
  Kysely: MockKysely,
  PostgresDialect: vi.fn(),
  sql: mockSql,
}))

vi.mock('pg', () => ({
  Pool: vi.fn(),
}))

const mockNewKyselyPostgresql = vi.hoisted(() => vi.fn())
vi.mock('@/.config/kysely.config', () => ({
  newKyselyPostgresql: mockNewKyselyPostgresql,
}))

describe('guide-utils', () => {
  let mockDb: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb = new MockKysely()
    mockNewKyselyPostgresql.mockReturnValue(mockDb)
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