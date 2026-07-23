import { describe, it, expect, vi, beforeEach } from 'vitest'

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
  generateClusterCode,
  generateClusterCodeSync,
  generateUniqueClusterCode,
  getPastorChurch,
  getChurchCluster,
  getClusterMembers,
  getClusterHistory,
  addClusterHistory,
  updateProfileScore,
  recalculateProfileScore,
} from '../gd-utils'

describe('generateClusterCode', () => {
  it('returns a 6-character uppercase alphanumeric string', () => {
    const code = generateClusterCode()
    expect(code).toHaveLength(6)
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
  })

  it('does not contain ambiguous characters (0, O, I, 1)', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateClusterCode()
      expect(code).not.toMatch(/[0OI1]/)
    }
  })
})

describe('generateClusterCodeSync', () => {
  it('returns a valid 6-character code', () => {
    const code = generateClusterCodeSync()
    expect(code).toHaveLength(6)
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
  })
})

describe('generateUniqueClusterCode', () => {
  it('returns a 6-character code when no collision', async () => {
    const mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
    } as any

    const code = await generateUniqueClusterCode(mockDb)
    expect(code).toHaveLength(6)
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
  })

  it('retries on collision and returns unique code', async () => {
    let callCount = 0
    const mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockImplementation(() => {
        callCount++
        return callCount <= 2 ? Promise.resolve({ id: 1 }) : Promise.resolve(null)
      }),
    } as any

    const code = await generateUniqueClusterCode(mockDb)
    expect(code).toHaveLength(6)
    expect(callCount).toBe(3)
  })

  it('throws after 10 failed attempts', async () => {
    const mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue({ id: 1 }),
    } as any

    await expect(generateUniqueClusterCode(mockDb)).rejects.toThrow(
      'Could not generate unique cluster code after 10 attempts'
    )
  })
})

describe('getPastorChurch', () => {
  it('returns the church created by the given user', async () => {
    const church = { id: 1, name: 'Iglesia Centro', created_by: 5 }
    const mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(church),
    } as any

    const result = await getPastorChurch(mockDb, 5)
    expect(result).toEqual(church)
  })

  it('returns null when user has no church', async () => {
    const mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
    } as any

    const result = await getPastorChurch(mockDb, 99)
    expect(result).toBeNull()
  })
})

describe('getChurchCluster', () => {
  it('returns cluster membership when church belongs to a cluster', async () => {
    const membership = { clustergd_id: 1, joined_at: new Date(), left_at: null }
    const mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(membership),
    } as any

    const result = await getChurchCluster(mockDb, 1)
    expect(result).toEqual(membership)
  })

  it('returns null when church has no active cluster membership', async () => {
    const mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
    } as any

    const result = await getChurchCluster(mockDb, 99)
    expect(result).toBeNull()
  })
})

describe('getClusterMembers', () => {
  it('returns list of active members with church names', async () => {
    const members = [
      { church_id: 1, church_name: 'Iglesia A', joined_at: new Date('2026-01-01') },
      { church_id: 2, church_name: 'Iglesia B', joined_at: new Date('2026-02-01') },
    ]
    const mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue(members),
    } as any

    const result = await getClusterMembers(mockDb, 1)
    expect(result).toEqual(members)
    expect(result).toHaveLength(2)
  })

  it('returns empty array when cluster has no members', async () => {
    const mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
    } as any

    const result = await getClusterMembers(mockDb, 99)
    expect(result).toEqual([])
  })
})

describe('getClusterHistory', () => {
  it('returns history entries ordered by date descending', async () => {
    const history = [
      { event_type: 'church_join', old_value: null, new_value: 'Iglesia C', changed_by: 3, created_at: new Date('2026-03-01') },
      { event_type: 'name_change', old_value: 'Old', new_value: 'New', changed_by: 2, created_at: new Date('2026-02-01') },
    ]
    const mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue(history),
    } as any

    const result = await getClusterHistory(mockDb, 1)
    expect(result).toEqual(history)
    expect(result).toHaveLength(2)
  })
})

describe('addClusterHistory', () => {
  it('inserts a history record', async () => {
    const mockInsert = vi.fn().mockReturnThis()
    const mockValues = vi.fn().mockReturnThis()
    const mockExecute = vi.fn().mockResolvedValue(undefined)

    const mockDb = {
      insertInto: mockInsert,
      values: mockValues,
      execute: mockExecute,
      selectFrom: vi.fn(),
      select: vi.fn(),
      where: vi.fn(),
      orderBy: vi.fn(),
    } as any

    mockInsert.mockReturnValue({ values: mockValues })
    mockValues.mockReturnValue({ execute: mockExecute })

    await addClusterHistory(mockDb, 1, 'church_join', null, 'Iglesia A', 5)

    expect(mockInsert).toHaveBeenCalledWith('clustergd_history')
    expect(mockValues).toHaveBeenCalledWith({
      clustergd_id: 1,
      event_type: 'church_join',
      old_value: null,
      new_value: 'Iglesia A',
      changed_by: 5,
    })
  })
})

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

  it('returns 25 when nombre === passport_name', async () => {
    const mockDb = mockDbWith({
      nombre: 'Test', passport_name: 'Test',
      pais_id: null, passport_nationality: null,
      email: null, verified_email: null,
      lastgooddollarverification: null,
      department_id: null, municipality_id: null, city_id: null,
      verified_department_id: null, verified_municipality_id: null, verified_city_id: null,
      place_of_worship: null, verified_place_of_worship: null,
    })
    const score = await recalculateProfileScore(mockDb, 1)
    expect(score).toBe(25)
  })

  it('returns 50 when name + country verified', async () => {
    const mockDb = mockDbWith({
      nombre: 'Test', passport_name: 'Test',
      pais_id: 1, passport_nationality: 1,
      email: null, verified_email: null,
      lastgooddollarverification: null,
      department_id: null, municipality_id: null, city_id: null,
      verified_department_id: null, verified_municipality_id: null, verified_city_id: null,
      place_of_worship: null, verified_place_of_worship: null,
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
      department_id: 5, municipality_id: 10, city_id: 15,
      verified_department_id: 5, verified_municipality_id: 10, verified_city_id: 15,
      place_of_worship: 'Church', verified_place_of_worship: 'Church',
    }, true)
    const score = await recalculateProfileScore(mockDb, 1)
    expect(score).toBe(100)
  })
})
