import { describe, it, expect, vi } from 'vitest'
import { canAccessCourse, canPurchaseGDCourse } from '../course-access'

// Returns a sequence of rows, one per executeTakeFirst call. This lets us
// simulate the ordered Kysely queries inside canAccessCourse (course, then
// enrollment) and canPurchaseGDCourse (usuario, then church).
function mockDbSeq(rows: any[]) {
  let i = 0
  const mock = {
    selectFrom: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn().mockImplementation(() =>
      Promise.resolve(rows[i++] ?? null),
    ),
  } as any
  return mock
}

describe('canAccessCourse', () => {
  it('grants access to a free course (porPagar 0) without enrollment', async () => {
    const db = mockDbSeq([{ porPagar: 0 }])
    const result = await canAccessCourse(db, 1, 5)
    expect(result).toEqual({ access: true })
  })

  it('grants access to a free course (porPagar null)', async () => {
    const db = mockDbSeq([{ porPagar: null }])
    const result = await canAccessCourse(db, 1, 5)
    expect(result).toEqual({ access: true })
  })

  it('denies access when premium and not purchased', async () => {
    const db = mockDbSeq([{ porPagar: 1 }, null])
    const result = await canAccessCourse(db, 1, 5)
    expect(result.access).toBe(false)
    expect(result.reason).toContain('premium')
  })

  it('grants access when premium and purchased', async () => {
    const db = mockDbSeq([{ porPagar: 1 }, { id: 1 }])
    const result = await canAccessCourse(db, 1, 5)
    expect(result).toEqual({ access: true })
  })
})

const PILOT_COLOMBIA = 170
const PILOT_SIERRA_LEONE = 694

const nonZionistChurch = {
  id: 1,
  pastor_id: 99,
  pastoral_position_israel_covenant: 'no',
  pastoral_position_israel_remnant: 'yes',
  pastoral_position_israel_gaza: 'no',
}

function userRow(overrides: Record<string, any> = {}) {
  return {
    religion_id: 2,
    pais_id: PILOT_COLOMBIA,
    church_id: 1,
    ...overrides,
  }
}

describe('canPurchaseGDCourse', () => {
  it('denies when user is not found', async () => {
    const db = mockDbSeq([null])
    const result = await canPurchaseGDCourse(db, 42)
    expect(result.access).toBe(false)
  })

  it('denies non-Christians (religion_id !== 2)', async () => {
    const db = mockDbSeq([userRow({ religion_id: 3 })])
    const result = await canPurchaseGDCourse(db, 42)
    expect(result.access).toBe(false)
    expect(result.reason).toContain('Christians')
  })

  it('denies Christians outside pilot countries', async () => {
    // United States (not in pilot)
    const db = mockDbSeq([userRow({ pais_id: 76 })])
    const result = await canPurchaseGDCourse(db, 42)
    expect(result.access).toBe(false)
    expect(result.reason).toContain('pilot')
  })

  it('denies Christians with no country set', async () => {
    const db = mockDbSeq([userRow({ pais_id: null })])
    const result = await canPurchaseGDCourse(db, 42)
    expect(result.access).toBe(false)
  })

  it('denies Christians in pilot country without a church', async () => {
    const db = mockDbSeq([userRow({ church_id: null })])
    const result = await canPurchaseGDCourse(db, 42)
    expect(result.access).toBe(false)
    expect(result.reason).toContain('church')
  })

  it('denies when the church record does not exist', async () => {
    const db = mockDbSeq([userRow(), null])
    const result = await canPurchaseGDCourse(db, 42)
    expect(result.access).toBe(false)
    expect(result.reason).toContain('church')
  })

  it('denies when the church has no pastor registered', async () => {
    const db = mockDbSeq([userRow(), { ...nonZionistChurch, pastor_id: null }])
    const result = await canPurchaseGDCourse(db, 42)
    expect(result.access).toBe(false)
    expect(result.reason).toContain('pastor')
  })

  it('denies when the church has no pastor_id column at all', async () => {
    const { pastor_id, ...noPastor } = nonZionistChurch
    const db = mockDbSeq([userRow(), noPastor])
    const result = await canPurchaseGDCourse(db, 42)
    expect(result.access).toBe(false)
    expect(result.reason).toContain('pastor')
  })

  it('denies when pastor is Zionist (covenant=yes)', async () => {
    const church = {
      ...nonZionistChurch,
      pastoral_position_israel_covenant: 'yes',
    }
    const db = mockDbSeq([userRow(), church])
    const result = await canPurchaseGDCourse(db, 42)
    expect(result.access).toBe(false)
    expect(result.reason).toContain('non-Zionist')
  })

  it('denies when pastor is Zionist (remnant=no)', async () => {
    const church = {
      ...nonZionistChurch,
      pastoral_position_israel_remnant: 'no',
    }
    const db = mockDbSeq([userRow(), church])
    const result = await canPurchaseGDCourse(db, 42)
    expect(result.access).toBe(false)
    expect(result.reason).toContain('non-Zionist')
  })

  it('denies when pastor is Zionist (gaza=yes)', async () => {
    const church = {
      ...nonZionistChurch,
      pastoral_position_israel_gaza: 'yes',
    }
    const db = mockDbSeq([userRow(), church])
    const result = await canPurchaseGDCourse(db, 42)
    expect(result.access).toBe(false)
    expect(result.reason).toContain('non-Zionist')
  })

  it('denies when any answer is null (unknown position)', async () => {
    const church = {
      ...nonZionistChurch,
      pastoral_position_israel_covenant: null,
    }
    const db = mockDbSeq([userRow(), church])
    const result = await canPurchaseGDCourse(db, 42)
    expect(result.access).toBe(false)
    expect(result.reason).toContain('non-Zionist')
  })

  it('grants a Christian church member in Colombia with a non-Zionist pastor', async () => {
    const db = mockDbSeq([userRow({ pais_id: PILOT_COLOMBIA }), nonZionistChurch])
    const result = await canPurchaseGDCourse(db, 42)
    expect(result).toEqual({ access: true })
  })

  it('grants a Christian church member in Sierra Leone with a non-Zionist pastor', async () => {
    const db = mockDbSeq([
      userRow({ pais_id: PILOT_SIERRA_LEONE }),
      nonZionistChurch,
    ])
    const result = await canPurchaseGDCourse(db, 42)
    expect(result).toEqual({ access: true })
  })
})
