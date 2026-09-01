import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocks: awardReferralRewards (referral-payout) — la lógica de pago ya está
// unit-testeada en referral-rewards.test.ts; aquí solo se prueba la atribución.
const awardMock = vi.hoisted(() => vi.fn())
vi.mock('../referral-payout', () => ({
  awardReferralRewards: awardMock,
}))

import {
  MISSIONAL_COURSE_IDS,
  isMissionalCourse,
  awardMissionalScholarshipReferral,
} from '../referral-crossword'

describe('isMissionalCourse (REQ/163 Form 2 — solo cursos misionales)', () => {
  it('solo "Una relación con Jesús" (1) y "A relationship with Jesus" (2)', () => {
    expect(MISSIONAL_COURSE_IDS).toEqual([1, 2])
    expect(isMissionalCourse(1)).toBe(true)
    expect(isMissionalCourse(2)).toBe(true)
  })

  it('cursos no misionales → false (GD 10/11, Web3 & UBI 103, ...)', () => {
    expect(isMissionalCourse(10)).toBe(false)
    expect(isMissionalCourse(11)).toBe(false)
    expect(isMissionalCourse(102)).toBe(false)
    expect(isMissionalCourse(103)).toBe(false)
  })
})

describe('awardMissionalScholarshipReferral (REQ/163 Form 2)', () => {
  const base = {
    db: {} as any,
    referredUserId: 456,
    courseId: 1,
    guideId: 3,
    scholarshipUsdt: 1,
    scholarshipSlearn: 5,
  }

  beforeEach(() => awardMock.mockClear())

  it('curso missional + scholarship pagado → paga 10% al referidor', async () => {
    await awardMissionalScholarshipReferral(base)
    expect(awardMock).toHaveBeenCalledTimes(1)
    expect(awardMock).toHaveBeenCalledWith({
      db: base.db,
      referredUserId: 456,
      courseId: 1,
      guideId: 3,
      scholarshipUsdt: 1,
      scholarshipSlearn: 5,
    })
  })

  it('curso missional EN (id 2) también paga', async () => {
    await awardMissionalScholarshipReferral({ ...base, courseId: 2 })
    expect(awardMock).toHaveBeenCalledTimes(1)
  })

  it('curso NO missional → no paga (sin llamar a awardReferralRewards)', async () => {
    await awardMissionalScholarshipReferral({ ...base, courseId: 103 })
    expect(awardMock).not.toHaveBeenCalled()
  })

  it('sin scholarship pagado (0 / 0) → no paga', async () => {
    await awardMissionalScholarshipReferral({ ...base, scholarshipUsdt: 0, scholarshipSlearn: 0 })
    expect(awardMock).not.toHaveBeenCalled()
  })

  it('sin referidor → awardReferralRewards no hace nada (idempotente, out of scope aquí)', async () => {
    awardMock.mockResolvedValueOnce(undefined)
    await awardMissionalScholarshipReferral(base)
    expect(awardMock).toHaveBeenCalledTimes(1)
  })
})
