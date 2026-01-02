import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'

import { newKyselyPostgresql } from '@/.config/kysely.config'
import type { DB } from '@/db/db.d'

let _db: Kysely<DB> | null = null

// Objeto DB espía reutilizable en tests para que las expectativas como insertInto hayan sido llamadas funcionen
const testDb = (() => {
  if (process.env.NODE_ENV !== 'test') return null

  try {
    // Only import vitest in test environment
    const { vi } = require('vitest')
    const self: any = {}
    self.selectFrom = vi.fn(() => self)
    self.select = vi.fn(() => self)
    self.where = vi.fn(() => self)
    self.insertInto = vi.fn(() => self)
    self.values = vi.fn(() => self)
    self.updateTable = vi.fn(() => self)
    self.set = vi.fn(() => self)
    self.returningAll = vi.fn(() => self)
    self.execute = vi.fn(async () => [])
    self.executeTakeFirst = vi.fn(async () => null)
    return self
  } catch (error) {
    // vitest not available
    return null
  }
})()

export const db: any = process.env.NODE_ENV === 'test' ? testDb : undefined

export function getDb() {
  if (process.env.NODE_ENV === 'test' && testDb) {
    return testDb as unknown as Kysely<DB>
  }
  if (!_db) {
    _db = newKyselyPostgresql()
  }
  return _db
}
