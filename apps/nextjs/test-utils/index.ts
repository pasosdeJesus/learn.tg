/**
 * Test utilities index
 *
 * "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)
 */

export * from './db-mocks'
export * from './auth-mocks'
export * from './auth-db-mocks'
export * from './render-utils'
export * from './api-mocks'
export * from './crossword-mocks'
export * from './radix-mocks'

import { vi } from 'vitest'
import { apiDbMocks } from './db-mocks'
import { apiAuthMocks } from './auth-mocks'
import { setupApiMocks, resetApiMocks } from './api-mocks'
import { resetAllMocks } from './render-utils'

/**
 * Setup database mocks including @/db/database module
 * Call this in your test file's beforeAll
 */
export function setupDbMocks() {
  // Setup Kysely and PostgreSQL mocks
  apiDbMocks.setupMocks()

  // Mock @/db/database module to use our mock Kysely instance
  vi.mock('@/db/database', () => ({
    getDb: vi.fn(() => {
      const self: any = {}
      self.selectFrom = vi.fn(() => self)
      self.select = vi.fn((...args: any[]) => {
        // Handle sql template tag: sql`COUNT(*)`.as('count')
        // If first argument is a template literal array from sql``, treat specially
        return self
      })
      self.where = vi.fn(() => self)
      self.orderBy = vi.fn(() => self)
      self.limit = vi.fn(() => self)
      self.groupBy = vi.fn(() => self)
      self.having = vi.fn(() => self)
      self.leftJoin = vi.fn(() => self)
      self.innerJoin = vi.fn(() => self)
      self.insertInto = vi.fn(() => self)
      self.values = vi.fn(() => self)
      self.updateTable = vi.fn(() => self)
      self.set = vi.fn(() => self)
      self.returningAll = vi.fn(() => self)
      self.execute = apiDbMocks.mockExecute
      self.executeTakeFirst = apiDbMocks.mockExecuteTakeFirst
      return self
    }),
  }))
}

/**
 * Setup all mocks for a comprehensive test environment
 *
 * @param options Configuration options
 * @param options.db Whether to setup database mocks (default: true)
 * @param options.auth Whether to setup authentication mocks (default: false)
 * @param options.api Whether to setup API module mocks (default: true)
 */
export function setupAllMocks(options: {
  db?: boolean
  auth?: boolean
  api?: boolean
} = {}) {
  const { db = true, auth = false, api = true } = options

  if (api) {
    setupApiMocks()
  }

  if (db) {
    setupDbMocks()
  }

  if (auth) {
    apiAuthMocks.setupMocks()
    apiAuthMocks.setupDefaultImplementations()
  }

  // Configure sql template tag mock for kysely sql`` usage
  apiDbMocks.mockSql.mockImplementation(() => ({
    as: vi.fn().mockReturnValue({}),
    execute: apiDbMocks.mockSqlExecute,
    val: vi.fn((val) => val),
  }))
}

/**
 * Reset all mock implementations
 * Call this in your test file's beforeEach
 */
export function resetAllTestMocks() {
  resetAllMocks()
  resetApiMocks()
  apiDbMocks.resetMocks()
  apiAuthMocks.resetMocks?.()
}