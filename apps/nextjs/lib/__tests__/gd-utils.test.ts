import { describe, it, expect, vi } from 'vitest'

const { MockKysely } = vi.hoisted(() => {
  const MockKysely = vi.fn()
  return { MockKysely }
})

vi.mock('kysely', () => ({
  Kysely: MockKysely,
  PostgresDialect: vi.fn(),
  sql: vi.fn(),
}))

import {
  updateProfileScore,
  recalculateProfileScore,
} from '../gd-utils'

describe('updateProfileScore', () => {
  it('increments profile score by the given points', async () => {
    const mockSet = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockReturnThis()
    const mockExecute = vi.fn().mockResolvedValue(undefined)

    const mockDb = {
      updateTable: vi.fn().mockReturnValue({ set: mockSet }),
    } as any

    mockSet.mockReturnValue({ where: mockWhere })
    mockWhere.mockReturnValue({ execute: mockExecute })

    await updateProfileScore(mockDb, 5, 32)

    expect(mockDb.updateTable).toHaveBeenCalledWith('usuario')
    expect(mockSet).toHaveBeenCalled()
  })
})

describe('recalculateProfileScore', () => {
  // Helper: create mock DB with optional user data + no interview
  function mockDbWith(user: any, hasInterview = false) {
    const mock = {
      selectFrom: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(
        hasInterview ? { ...user, proposed_date_of_interview: new Date() } : { ...user, proposed_date_of_interview: null }
      ),
      updateTable: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue(undefined),
    } as any
    return mock
  }

  it('returns 26 when nombre === passport_name', async () => {
    const mockDb = mockDbWith({
      nombre: 'Test', passport_name: 'Test',
      pais_id: null, passport_nationality: null,
      email: null, verified_email: null,
      lastgooddollarverification: null,
      city_id: null, verified_city_id: null,
      place_of_worship: null, verified_place_of_worship: null,
      church_id: null,
      church_relationship: null, verified_church_relationship: null,
      religion_id: 2,
      place_of_worship_location: null, verified_place_of_worship_location: null,
    })
    const score = await recalculateProfileScore(mockDb, 1)
    expect(score).toBe(26)
  })

  it('returns 50 when name + country verified', async () => {
    const mockDb = mockDbWith({
      nombre: 'Test', passport_name: 'Test',
      pais_id: 1, passport_nationality: 1,
      email: null, verified_email: null,
      lastgooddollarverification: null,
      city_id: null, verified_city_id: null,
      place_of_worship: null, verified_place_of_worship: null,
      church_id: null,
      church_relationship: null, verified_church_relationship: null,
      religion_id: 2,
      place_of_worship_location: null, verified_place_of_worship_location: null,
    })
    const score = await recalculateProfileScore(mockDb, 1)
    expect(score).toBe(50)
  })

  it('returns 100 when all fields verified + interview', async () => {
    const mockDb = mockDbWith({
      nombre: 'Test', passport_name: 'Test',
      pais_id: 1, passport_nationality: 1,
      email: 'a@b.com', verified_email: 'a@b.com',
      whatsapp: '+123', telegram: null,
      verified_whatsapp: '+123', verified_telegram: null,
      lastgooddollarverification: new Date(),
      city_id: 15, verified_city_id: 15,
      place_of_worship: null, verified_place_of_worship: null,
      church_id: 1, church_relationship: 'leader', verified_church_relationship: 'leader',
      religion_id: 2,
      place_of_worship_location: null, verified_place_of_worship_location: null,
    }, true)
    const score = await recalculateProfileScore(mockDb, 1)
    expect(score).toBe(100)
  })
})
