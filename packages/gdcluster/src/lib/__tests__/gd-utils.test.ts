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
  getPastorChurch,
  getChurchCluster,
  getClusterMembers,
  getClusterHistory,
  addClusterHistory,
} from '../gd-utils.js'

describe('getPastorChurch', () => {
  it('returns the church assigned to the pastor', async () => {
    const church = { id: 1, name: 'Iglesia Centro', pastor_id: 5 }
    const mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(church),
    } as any

    const result = await getPastorChurch(mockDb, 5)
    expect(result).toEqual(church)
    expect(mockDb.innerJoin).toHaveBeenCalledWith('usuario as u', 'u.church_id', 'c.id')
  })

  it('returns null when user has no church', async () => {
    const mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
    } as any

    const result = await getPastorChurch(mockDb, 99)
    expect(result).toBeNull()
  })
})

describe('getChurchCluster', () => {
  function membershipDb(row: any) {
    const where: any[] = []
    const builder: any = {
      selectFrom: vi.fn(() => builder),
      innerJoin: vi.fn(() => builder),
      select: vi.fn(() => builder),
      where: vi.fn((...args: any[]) => {
        where.push(args)
        return builder
      }),
      executeTakeFirst: vi.fn().mockResolvedValue(row),
    }
    return { db: builder, where }
  }

  it('returns cluster membership when church belongs to a cluster', async () => {
    const membership = { clustergd_id: 1, joined_at: new Date(), left_at: null }
    const { db } = membershipDb(membership)

    const result = await getChurchCluster(db, 1)
    expect(result).toEqual(membership)
  })

  it('returns null when church has no active cluster membership', async () => {
    const { db } = membershipDb(null)

    const result = await getChurchCluster(db, 99)
    expect(result).toBeNull()
  })

  // Un clúster disuelto no puede seguir bloqueando a sus iglesias (medido 2026-11-18:
  // disolver el clúster dejaba a la iglesia con 409 al crear otro).
  it('ignores the membership of a disbanded cluster', async () => {
    const { db, where } = membershipDb(null)
    await getChurchCluster(db, 99)
    expect(where).toContainEqual(['cc.left_at', 'is', null])
    expect(where).toContainEqual(['c.status', '!=', 'disbanded'])
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
