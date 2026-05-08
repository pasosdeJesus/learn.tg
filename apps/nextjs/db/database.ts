import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'

import { newKyselyPostgresql } from '@/.config/kysely.config'
import type { DB } from '@/db/db.d'

let _db: Kysely<DB> | null = null

// Mock Kysely para tests usando createMockKysely de @pasosdejesus/m
const testDb: any = await (async () => {
  if (process.env.NODE_ENV !== 'test') return null
  try {
    const { createMockKysely } = await import('@pasosdejesus/m/test-utils/kysely-mocks')
    const { MockKysely } = createMockKysely()
    return new MockKysely()
  } catch {
    return null
  }
})()

export function getDb() {
  if (process.env.NODE_ENV === 'test' && testDb) {
    return testDb as Kysely<DB>
  }
  if (!_db) {
    _db = newKyselyPostgresql()
  }
  return _db
}

export const db = testDb
