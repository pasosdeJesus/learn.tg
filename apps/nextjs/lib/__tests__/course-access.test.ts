import { describe, it, expect, vi, beforeEach } from 'vitest'
import { canAccessCourse } from '../course-access'

function mockDb(churchRow: any | null) {
  const mock = {
    selectFrom: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn().mockResolvedValue(churchRow),
  } as any
  return mock
}

describe('canAccessCourse — course without access rules', () => {
  it('returns access:true for any course without explicit rules', async () => {
    const db = mockDb(null)
    const result = await canAccessCourse(db, 1, 5)
    expect(result).toEqual({ access: true })
  })

  it('returns access:true even when user has no church', async () => {
    const db = mockDb(null)
    const result = await canAccessCourse(db, 1, 99)
    expect(result).toEqual({ access: true })
  })
})

describe('canAccessCourse — Global Disciples (id=10)', () => {
  const courseId = 10
  const userId = 42

  it('grants access when all 3 answers match non-Zionist pattern (1=No, 2=Yes, 3=No)', async () => {
    const db = mockDb({
      id: 1,
      pastoral_position_israel_covenant: 'no',
      pastoral_position_israel_remnant: 'yes',
      pastoral_position_israel_gaza: 'no',
    })
    const result = await canAccessCourse(db, userId, courseId)
    expect(result).toEqual({ access: true })
  })

  it('denies access when user has no church', async () => {
    const db = mockDb(null)
    const result = await canAccessCourse(db, userId, courseId)
    expect(result.access).toBe(false)
    expect(result.reason).toContain('requires a registered church')
  })

  it('denies access with pending reason when any answer is null', async () => {
    const cases = [
      { pastoral_position_israel_covenant: null, pastoral_position_israel_remnant: 'yes', pastoral_position_israel_gaza: 'no' },
      { pastoral_position_israel_covenant: 'no', pastoral_position_israel_remnant: null, pastoral_position_israel_gaza: 'no' },
      { pastoral_position_israel_covenant: 'no', pastoral_position_israel_remnant: 'yes', pastoral_position_israel_gaza: null },
      { pastoral_position_israel_covenant: null, pastoral_position_israel_remnant: null, pastoral_position_israel_gaza: null },
    ]
    for (const row of cases) {
      const db = mockDb({ id: 1, ...row })
      const result = await canAccessCourse(db, userId, courseId)
      expect(result.access).toBe(false)
      expect(result.reason).toContain('theological position questions')
    }
  })

  it('denies access when any answer is undefined (missing column)', async () => {
    const db = mockDb({
      id: 1,
      pastoral_position_israel_covenant: 'no',
      pastoral_position_israel_remnant: 'yes',
      // gaza is undefined
    })
    const result = await canAccessCourse(db, userId, courseId)
    expect(result.access).toBe(false)
    expect(result.reason).toContain('theological position questions')
  })

  it('denies access when question 1 is yes (Zionist)', async () => {
    const db = mockDb({
      id: 1,
      pastoral_position_israel_covenant: 'yes',
      pastoral_position_israel_remnant: 'yes',
      pastoral_position_israel_gaza: 'no',
    })
    const result = await canAccessCourse(db, userId, courseId)
    expect(result.access).toBe(false)
    expect(result.reason).toContain('non-Zionist')
  })

  it('denies access when question 2 is no (Zionist)', async () => {
    const db = mockDb({
      id: 1,
      pastoral_position_israel_covenant: 'no',
      pastoral_position_israel_remnant: 'no',
      pastoral_position_israel_gaza: 'no',
    })
    const result = await canAccessCourse(db, userId, courseId)
    expect(result.access).toBe(false)
    expect(result.reason).toContain('non-Zionist')
  })

  it('denies access when question 3 is yes (unconditional support)', async () => {
    const db = mockDb({
      id: 1,
      pastoral_position_israel_covenant: 'no',
      pastoral_position_israel_remnant: 'yes',
      pastoral_position_israel_gaza: 'yes',
    })
    const result = await canAccessCourse(db, userId, courseId)
    expect(result.access).toBe(false)
    expect(result.reason).toContain('non-Zionist')
  })

  it('denies access when all 3 answers are inverted (full Zionist)', async () => {
    const db = mockDb({
      id: 1,
      pastoral_position_israel_covenant: 'yes',
      pastoral_position_israel_remnant: 'no',
      pastoral_position_israel_gaza: 'yes',
    })
    const result = await canAccessCourse(db, userId, courseId)
    expect(result.access).toBe(false)
  })

  it('denies access when only 2 out of 3 match', async () => {
    const partials = [
      { pastoral_position_israel_covenant: 'no', pastoral_position_israel_remnant: 'yes', pastoral_position_israel_gaza: 'yes' },
      { pastoral_position_israel_covenant: 'no', pastoral_position_israel_remnant: 'no', pastoral_position_israel_gaza: 'no' },
      { pastoral_position_israel_covenant: 'yes', pastoral_position_israel_remnant: 'yes', pastoral_position_israel_gaza: 'no' },
    ]
    for (const row of partials) {
      const db = mockDb({ id: 1, ...row })
      const result = await canAccessCourse(db, userId, courseId)
      expect(result.access).toBe(false)
    }
  })
})
