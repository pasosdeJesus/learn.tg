import { describe, it, expect } from 'vitest'
import { referralReward, canPayFromWallet } from '../referral-rewards'

// Tests TDD de la lógica pura de recompensas de referidos (https://github.com/pasosdeJesus/learn.tg/issues/163 §1).

describe('referralReward — Form 1 (10% del curso premium, 50/50 USDT/SLEARN)', () => {
  it('precio 100 → 5 USDT + 5 SLEARN (10% = 10, mitad cada uno)', () => {
    expect(referralReward(1, { coursePriceUsdt: 100 })).toEqual({ usdt: 5, slearn: 5 })
  })

  it('precio 0 → sin recompensa', () => {
    expect(referralReward(1, { coursePriceUsdt: 0 })).toEqual({ usdt: 0, slearn: 0 })
  })

  it('redondea a 2 decimales (precio 33.33 → 10% / 2 = 1.6665 → 1.67)', () => {
    expect(referralReward(1, { coursePriceUsdt: 33.33 })).toEqual({ usdt: 1.67, slearn: 1.67 })
  })
})

describe('referralReward — Form 2 (10% del scholarship missional)', () => {
  it('scholarship USDT 1.00 + SLEARN 5 → 0.10 USDT + 0.50 SLEARN (ejemplo https://github.com/pasosdeJesus/learn.tg/issues/163 §1.3)', () => {
    expect(referralReward(2, { scholarshipUsdt: 1, scholarshipSlearn: 5 })).toEqual({
      usdt: 0.1,
      slearn: 0.5,
    })
  })

  it('sin scholarship → sin recompensa', () => {
    expect(referralReward(2, {})).toEqual({ usdt: 0, slearn: 0 })
  })
})

describe('referralReward — Form 3 (1 USDT pastor bonus)', () => {
  it('referido pastor + curso GD → 1 USDT', () => {
    expect(referralReward(3, { isPastorReferral: true })).toEqual({ usdt: 1, slearn: 0 })
  })

  it('referido NO pastor → sin recompensa', () => {
    expect(referralReward(3, { isPastorReferral: false })).toEqual({ usdt: 0, slearn: 0 })
  })

  it('sin dato → sin recompensa', () => {
    expect(referralReward(3, {})).toEqual({ usdt: 0, slearn: 0 })
  })
})

describe('canPayFromWallet — funding rule (pagar desde la referral wallet)', () => {
  it('wallet con fondos suficientes → true', () => {
    expect(canPayFromWallet({ usdt: 5, slearn: 5 }, { usdt: 100, slearn: 100 })).toBe(true)
  })

  it('wallet vacía → false (recompensa omitida)', () => {
    expect(canPayFromWallet({ usdt: 5, slearn: 5 }, { usdt: 0, slearn: 0 })).toBe(false)
  })

  it('fondos parciales (USDT sí, SLEARN no) → false', () => {
    expect(canPayFromWallet({ usdt: 5, slearn: 5 }, { usdt: 10, slearn: 0 })).toBe(false)
  })
})
