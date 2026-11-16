import { describe, it, expect } from 'vitest'
import { presentationDataHash, walletHash } from '../cluster-approvals.js'

// Las aprobaciones de los pastores valen para un conjunto exacto de datos y, en otra
// fase, para una billetera concreta (R-#161, REQ/161 §4.7): cualquier cambio material
// cambia el hash de su fase y caduca esa aprobación, no la otra.

const data = {
  fourth_year_budget: 500,
  budget_draft_path: 'cluster/3/budget.pdf',
  director_offer_path: 'cluster/3/director.pdf',
  director_first_year_pay: 180,
  director_first_year_hours: 320,
}
const wallet = '0x84272a6dd0D5fE9ea2Ab28Cf96e72f4F7da00C5C'

describe('presentationDataHash (R-#161)', () => {
  it('is stable for the same data', () => {
    expect(presentationDataHash(data)).toBe(presentationDataHash({ ...data }))
  })

  it('changes with any of the five fields', () => {
    const base = presentationDataHash(data)
    expect(presentationDataHash({ ...data, fourth_year_budget: 501 })).not.toBe(base)
    expect(presentationDataHash({ ...data, budget_draft_path: 'cluster/3/budget2.pdf' })).not.toBe(base)
    expect(presentationDataHash({ ...data, director_offer_path: 'cluster/3/offer2.pdf' })).not.toBe(base)
    expect(presentationDataHash({ ...data, director_first_year_pay: 181 })).not.toBe(base)
    expect(presentationDataHash({ ...data, director_first_year_hours: 321 })).not.toBe(base)
  })

  it('does not depend on the wallet: that is the other phase', () => {
    expect(presentationDataHash(data)).toBe(presentationDataHash(data))
  })
})

describe('walletHash (R-#161)', () => {
  it('is stable for the same address', () => {
    expect(walletHash(wallet)).toBe(walletHash(`${wallet}`))
  })

  it('changes with the address, including the casing', () => {
    expect(walletHash(wallet)).not.toBe(walletHash('0x1234567890123456789012345678901234567890'))
    expect(walletHash(wallet)).not.toBe(walletHash(wallet.toLowerCase()))
  })

  it('hashes the empty wallet instead of throwing', () => {
    expect(walletHash(null)).toBe(walletHash(''))
    expect(walletHash(null)).not.toBe(walletHash(wallet))
  })
})
