import { describe, it, expect } from 'vitest'
import { getDb } from '../database'
import { testDb } from '../test-db'

describe('database', () => {
  it('testDb is a MockKysely instance', () => {
    expect(testDb).toBeDefined()
    expect(testDb).not.toBeNull()
    expect(typeof testDb.selectFrom).toBe('function')
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
