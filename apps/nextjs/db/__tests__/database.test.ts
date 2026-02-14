import { describe, it, expect } from 'vitest'
import { db, getDb } from '../database'

describe('database', () => {
  // Note: In test environment, db is null because testDb is null
  // but getDb returns a mock Kysely instance (from global mocks)
  it('db is null in test environment', () => {
    expect(db).toBeNull()
  })

  it('getDb returns a Kysely-like object in test environment', () => {
    const database = getDb()
    expect(database).toBeDefined()
    expect(database).not.toBeNull()
    // Should have Kysely-like methods
    expect(database.selectFrom).toBeDefined()
    expect(database.insertInto).toBeDefined()
    expect(database.updateTable).toBeDefined()
  })

  it('getDb returns same instance on subsequent calls', () => {
    const db1 = getDb()
    const db2 = getDb()
    expect(db1).toBe(db2)
  })
})