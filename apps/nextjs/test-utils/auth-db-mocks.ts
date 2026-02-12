/**
 * Combined authentication and database mocking utilities for auth-options tests
 *
 * "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)
 */

import { vi } from 'vitest'
import { createAuthMocks, AuthMockConfig } from './auth-mocks'
import { createMockKysely } from './db-mocks'

export interface AuthDbMockConfig extends AuthMockConfig {
  executeTakeFirst?: any
  execute?: any
  sqlExecute?: any
}

/**
 * Creates combined authentication and database mocks for auth-options tests
 *
 * @param config Configuration for mock behavior
 * @returns Object containing all mocks and setup helpers
 */
export function createAuthDbMocks(config: AuthDbMockConfig = {}) {
  // Create authentication mocks
  const authMocks = createAuthMocks(config)

  // Create database mocks with individual chainable mocks
  const mockExecuteTakeFirst = vi.hoisted(() => vi.fn())
  const mockExecute = vi.hoisted(() => vi.fn())
  const mockSqlExecute = vi.hoisted(() => vi.fn())

  // Apply custom implementations if provided
  if (config.executeTakeFirst !== undefined) {
    mockExecuteTakeFirst.mockImplementation(config.executeTakeFirst)
  }
  if (config.execute !== undefined) {
    mockExecute.mockImplementation(config.execute)
  }
  if (config.sqlExecute !== undefined) {
    mockSqlExecute.mockImplementation(config.sqlExecute)
  }

  // Individual chainable mocks for Kysely operations
  const mockSelectFrom = vi.hoisted(() => vi.fn(() => ({
    where: vi.fn(() => ({
      selectAll: vi.fn(() => ({
        executeTakeFirst: mockExecuteTakeFirst
      }))
    }))
  })))

  const mockInsertInto = vi.hoisted(() => vi.fn(() => ({
    values: vi.fn(() => ({
      returningAll: vi.fn(() => ({
        executeTakeFirstOrThrow: vi.fn()
      }))
    }))
  })))

  const mockUpdateTable = vi.hoisted(() => vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        execute: vi.fn()
      }))
    }))
  })))

  const mockSql = vi.hoisted(() => vi.fn(() => ({
    execute: mockSqlExecute,
    val: vi.fn((val) => val),
  })))

  // Mock Kysely instance that uses the individual mocks
  const mockKysely = vi.hoisted(() => ({
    selectFrom: mockSelectFrom,
    insertInto: mockInsertInto,
    updateTable: mockUpdateTable
  }))

  const mockPgPool = vi.hoisted(() => vi.fn())

  /**
   * Setup vi.mock calls for all modules (auth + db)
   */
  function setupMocks() {
    // Setup authentication mocks
    authMocks.setupMocks()

    // Setup database mocks
    vi.mock('kysely', () => ({
      Kysely: vi.fn(() => mockKysely),
      PostgresDialect: vi.fn(),
      sql: mockSql,
    }))

    vi.mock('pg', () => ({
      Pool: mockPgPool,
    }))

    vi.mock('@/.config/kysely.config', () => ({
      newKyselyPostgresql: vi.fn(() => mockKysely),
    }))
  }

  /**
   * Set up default mock implementations based on config
   */
  function setupDefaultImplementations() {
    authMocks.setupDefaultImplementations()

    // Default database responses
    mockExecuteTakeFirst.mockResolvedValue(null)
    mockExecute.mockResolvedValue([])
    mockSqlExecute.mockResolvedValue({ rows: [] })

    // Default SiweMessage implementation (already set by authMocks)
    // Ensure it matches the test expectations
    authMocks.mocks.mockSiweMessage.mockImplementation(() => ({
      address: config.address || '0x1234567890123456789012345678901234567890',
      verify: vi.fn().mockResolvedValue({
        success: config.siweVerificationSuccess ?? true,
        data: { nonce: 'mock-nonce', chainId: 1 },
      }),
    }))
  }

  /**
   * Reset all mock implementations
   */
  function resetMocks() {
    authMocks.resetMocks()
    mockExecuteTakeFirst.mockReset()
    mockExecute.mockReset()
    mockSqlExecute.mockReset()
    mockSql.mockReset()
    mockPgPool.mockReset()
    mockSelectFrom.mockReset()
    mockInsertInto.mockReset()
    mockUpdateTable.mockReset()
  }

  /**
   * Update mock configurations dynamically
   */
  function updateConfig(newConfig: Partial<AuthDbMockConfig>) {
    authMocks.updateConfig(newConfig)

    if (newConfig.executeTakeFirst !== undefined) {
      mockExecuteTakeFirst.mockImplementation(newConfig.executeTakeFirst)
    }
    if (newConfig.execute !== undefined) {
      mockExecute.mockImplementation(newConfig.execute)
    }
    if (newConfig.sqlExecute !== undefined) {
      mockSqlExecute.mockImplementation(newConfig.sqlExecute)
    }
  }

  return {
    // Authentication mocks
    mocks: {
      ...authMocks.mocks,
      // Database mocks
      mockExecuteTakeFirst,
      mockExecute,
      mockSqlExecute,
      mockSql,
      mockPgPool,
      mockSelectFrom,
      mockInsertInto,
      mockUpdateTable,
      mockKysely,
    },
    // Helper functions
    setupMocks,
    setupDefaultImplementations,
    resetMocks,
    updateConfig,
    // Individual mock references for convenience
    mockSiweMessage: authMocks.mocks.mockSiweMessage,
    mockGetCsrfToken: authMocks.mocks.mockGetCsrfToken,
    mockExecuteTakeFirst,
    mockExecute,
    mockSql,
    mockSqlExecute,
    mockSelectFrom,
    mockInsertInto,
    mockUpdateTable,
  }
}

/**
 * Pre-configured combined mocks for auth-options tests
 */
export const authOptionsMocks = createAuthDbMocks()