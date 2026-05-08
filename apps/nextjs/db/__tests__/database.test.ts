import { describe, it, expect } from 'vitest'
import { db, getDb } from '../database'

describe('database', () => {
  it('db is a MockKysely instance in test environment', () => {
    expect(db).toBeDefined()
    expect(db).not.toBeNull()
    expect(typeof db.selectFrom).toBe('function')
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
