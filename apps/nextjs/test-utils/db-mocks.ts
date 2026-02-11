/**
 * Database mocking utilities for tests
 *
 * "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)
 */

import { vi } from 'vitest'

/**
 * Creates a mock Kysely instance with configurable behavior
 *
 * @param options Configuration for mock behavior
 * @returns Object containing mocked Kysely instance and helper functions
 */
export function createMockKysely(options: {
  executeTakeFirst?: any
  execute?: any
  sqlExecute?: any
} = {}) {
  const mockExecuteTakeFirst = vi.hoisted(() => vi.fn())
  const mockExecute = vi.hoisted(() => vi.fn())
  const mockSqlExecute = vi.hoisted(() => vi.fn())

  // Apply custom implementations if provided
  if (options.executeTakeFirst !== undefined) {
    mockExecuteTakeFirst.mockImplementation(options.executeTakeFirst)
  }
  if (options.execute !== undefined) {
    mockExecute.mockImplementation(options.execute)
  }
  if (options.sqlExecute !== undefined) {
    mockSqlExecute.mockImplementation(options.sqlExecute)
  }

  const MockKysely = vi.hoisted(() => {
    return class MockKysely {
      selectFrom() { return this }
      where() { return this }
      selectAll() { return this }
      select(...args: any[]) {
        // Handle both select(columns) and select(aliases)
        return this
      }
      orderBy() { return this }
      limit() { return this }
      groupBy() { return this }
      having() { return this }
      leftJoin() { return this }
      innerJoin() { return this }
      insertInto() { return this }
      values() { return this }
      returningAll() { return this }
      updateTable() { return this }
      set() { return this }
      deleteFrom() { return this }
      with() { return this }

      // Query execution methods
      executeTakeFirst() { return mockExecuteTakeFirst() }
      executeTakeFirstOrThrow() { return mockExecuteTakeFirst() }
      execute() { return mockExecute() }

      // Function builder
      fn = {
        countAll: vi.fn(() => ({ as: vi.fn(() => ({})) })),
        sum: vi.fn(() => ({ as: vi.fn(() => ({})) })),
        avg: vi.fn(() => ({ as: vi.fn(() => ({})) })),
        max: vi.fn(() => ({ as: vi.fn(() => ({})) })),
        min: vi.fn(() => ({ as: vi.fn(() => ({})) })),
      }
    }
  })

  const mockSql = vi.hoisted(() => vi.fn(() => ({
    execute: mockSqlExecute,
    val: vi.fn((val) => val),
  })))

  const mockPgPool = vi.hoisted(() => vi.fn())

  return {
    MockKysely,
    mockExecuteTakeFirst,
    mockExecute,
    mockSqlExecute,
    mockSql,
    mockPgPool,

    /**
     * Setup vi.mock calls for Kysely and related modules
     * Call this in your test file's setup
     */
    setupMocks() {
      vi.mock('kysely', () => ({
        Kysely: MockKysely,
        PostgresDialect: vi.fn(),
        sql: mockSql,
      }))

      vi.mock('pg', () => ({
        Pool: mockPgPool,
      }))

      vi.mock('@/.config/kysely.config', () => ({
        newKyselyPostgresql: vi.fn(() => new MockKysely()),
      }))
    },

    /**
     * Reset all mock implementations
     */
    resetMocks() {
      mockExecuteTakeFirst.mockReset()
      mockExecute.mockReset()
      mockSqlExecute.mockReset()
      mockSql.mockReset()
      mockPgPool.mockReset()
    },

    /**
     * Set up common mock responses for database queries
     */
    setupCommonResponses() {
      // Default empty responses
      mockExecuteTakeFirst.mockResolvedValue(null)
      mockExecute.mockResolvedValue([])
      mockSqlExecute.mockResolvedValue({ rows: [] })
    },
  }
}

/**
 * Pre-configured mock for database operations in API routes
 */
export const apiDbMocks = createMockKysely()

/**
 * Pre-configured mock for database operations in lib functions
 */
export const libDbMocks = createMockKysely()