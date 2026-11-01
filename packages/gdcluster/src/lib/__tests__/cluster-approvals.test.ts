import { describe, it, expect } from 'vitest'
import { presentationDataHash } from '../cluster-approvals.js'

// La aprobación de los pastores vale para un conjunto exacto de datos + billetera
// (R-#161): cualquier cambio material cambia el hash y caduca la aprobación.

const data = {
  first_year_budget: 500,
  budget_draft_path: 'cluster/3/budget.pdf',
  director_offer_path: 'cluster/3/director.pdf',
  director_first_year_pay: 180,
  director_first_year_hours: 320,
}
const wallet = '0x84272a6dd0D5fE9ea2Ab28Cf96e72f4F7da00C5C'

describe('presentationDataHash (R-#161)', () => {
  it('is stable for the same data and wallet', () => {
    expect(presentationDataHash(data, wallet)).toBe(presentationDataHash({ ...data }, wallet))
  })

  it('changes with any of the five fields', () => {
    const base = presentationDataHash(data, wallet)
    expect(presentationDataHash({ ...data, first_year_budget: 501 }, wallet)).not.toBe(base)
    expect(presentationDataHash({ ...data, budget_draft_path: 'cluster/3/budget2.pdf' }, wallet)).not.toBe(base)
    expect(presentationDataHash({ ...data, director_offer_path: 'cluster/3/offer2.pdf' }, wallet)).not.toBe(base)
    expect(presentationDataHash({ ...data, director_first_year_pay: 181 }, wallet)).not.toBe(base)
    expect(presentationDataHash({ ...data, director_first_year_hours: 321 }, wallet)).not.toBe(base)
  })

  it('changes with the cluster wallet', () => {
    expect(presentationDataHash(data, wallet)).not.toBe(
      presentationDataHash(data, '0x1234567890123456789012345678901234567890'),
    )
  })
})
