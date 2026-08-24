import { describe, it, expect, vi } from 'vitest'
import { canAccessCourse, canPurchaseGDCourse } from '../course-access'
import { courseAccessReasonText } from '../course-access-msg'

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
    expect(result.reason).toBe('premium_purchase_required')
  })

  it('grants access when premium and purchased', async () => {
    const db = mockDbSeq([{ porPagar: 1 }, { id: 1 }])
    const result = await canAccessCourse(db, 1, 5)
    expect(result).toEqual({ access: true })
  })
})

const PILOT_COLOMBIA = 170
const PILOT_SIERRA_LEONE = 694

function userRow(overrides: Record<string, any> = {}) {
  return {
    religion_id: 2,
    pais_id: PILOT_COLOMBIA,
    verified_city_id: 1,
    verified_place_of_worship_location: 'Bogotá',
    position_israel_gaza: 'no',
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
    expect(result.reason).toBe('gd_for_christians')
  })

  it('denies Christians outside pilot countries', async () => {
    // United States (not in pilot)
    const db = mockDbSeq([userRow({ pais_id: 76 })])
    const result = await canPurchaseGDCourse(db, 42)
    expect(result.access).toBe(false)
    expect(result.reason).toBe('gd_pilot_countries')
  })

  it('denies Christians with no country set', async () => {
    const db = mockDbSeq([userRow({ pais_id: null })])
    const result = await canPurchaseGDCourse(db, 42)
    expect(result.access).toBe(false)
  })

  it('denies Christians in pilot country without a verified church city', async () => {
    const db = mockDbSeq([userRow({ verified_city_id: null, verified_place_of_worship_location: null })])
    const result = await canPurchaseGDCourse(db, 42)
    expect(result.access).toBe(false)
    expect(result.reason).toBe('gd_verified_city_required')
  })

  it('allows a text-only verified worship location (non-centro-poblado country)', async () => {
    const db = mockDbSeq([userRow({ pais_id: PILOT_SIERRA_LEONE, verified_city_id: null, verified_place_of_worship_location: 'Freetown' })])
    const result = await canPurchaseGDCourse(db, 42)
    expect(result.access).toBe(true)
  })

  it('denies when the Gaza answer is yes (supports Israel in the genocide)', async () => {
    const db = mockDbSeq([userRow({ position_israel_gaza: 'yes' })])
    const result = await canPurchaseGDCourse(db, 42)
    expect(result.access).toBe(false)
    expect(result.reason).toBe('gd_non_zionist')
  })

  it('denies when the Gaza answer is null (unknown position)', async () => {
    const db = mockDbSeq([userRow({ position_israel_gaza: null })])
    const result = await canPurchaseGDCourse(db, 42)
    expect(result.access).toBe(false)
    expect(result.reason).toBe('gd_non_zionist')
  })

  it('grants a verified Christian in Colombia who answered no to the Gaza question', async () => {
    const db = mockDbSeq([userRow({ pais_id: PILOT_COLOMBIA, position_israel_gaza: 'no' })])
    const result = await canPurchaseGDCourse(db, 42)
    expect(result).toEqual({ access: true })
  })

  it('grants a verified Christian in Sierra Leone who answered no to the Gaza question', async () => {
    const db = mockDbSeq([userRow({ pais_id: PILOT_SIERRA_LEONE, position_israel_gaza: 'no' })])
    const result = await canPurchaseGDCourse(db, 42)
    expect(result).toEqual({ access: true })
  })
})

describe('courseAccessReasonText', () => {
  it('translates known keys to Spanish', () => {
    expect(courseAccessReasonText('gd_for_christians', 'es')).toBe('Este curso es para cristianos.')
    expect(courseAccessReasonText('gd_pilot_countries', 'es')).toContain('países piloto')
    expect(courseAccessReasonText('gd_verified_city_required', 'es')).toContain('ciudad de culto verificada')
    expect(courseAccessReasonText('premium_purchase_required', 'es')).toContain('curso premium')
    expect(courseAccessReasonText('gd_non_zionist', 'es')).toContain('no sionistas')
    expect(courseAccessReasonText('auth_required', 'es')).toContain('autenticación')
  })

  it('keeps English for en and returns unknown keys as-is', () => {
    expect(courseAccessReasonText('gd_for_christians', 'en')).toContain('Christians')
    expect(courseAccessReasonText('some_unknown_key', 'es')).toBe('some_unknown_key')
    expect(courseAccessReasonText(null, 'es')).toBe('')
  })
})
