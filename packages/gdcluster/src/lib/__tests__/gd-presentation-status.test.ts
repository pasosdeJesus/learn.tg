import { describe, it, expect } from 'vitest'
import {
  canTransitionPresentation,
  missingPresentationData,
  presentationFieldsLocked,
} from '../gd-presentation.js'

// Reglas de la presentación a Global Disciples (R-#161): qué estados bloquean los datos
// del presupuesto/director, qué transiciones acepta pdJ y qué falta para poder pedirla.

describe('presentationFieldsLocked (R-#161)', () => {
  it('locks the five fields while the request is in flight or approved', () => {
    for (const status of ['requested', 'under_review', 'approved', 'sent', 'answered']) {
      expect(presentationFieldsLocked(status)).toBe(true)
    }
  })

  it('keeps the fields editable without a request, after a return or after cancelling', () => {
    for (const status of [null, undefined, 'returned', 'cancelled']) {
      expect(presentationFieldsLocked(status)).toBe(false)
    }
  })
})

describe('canTransitionPresentation (R-#161)', () => {
  it('follows the pdJ pipeline', () => {
    expect(canTransitionPresentation('requested', 'under_review')).toBe(true)
    expect(canTransitionPresentation('under_review', 'returned')).toBe(true)
    expect(canTransitionPresentation('returned', 'approved')).toBe(true)
    expect(canTransitionPresentation('approved', 'sent')).toBe(true)
    expect(canTransitionPresentation('sent', 'answered')).toBe(true)
  })

  it('rejects skipping steps and leaving a terminal state', () => {
    expect(canTransitionPresentation('requested', 'answered')).toBe(false)
    expect(canTransitionPresentation('requested', 'sent')).toBe(false)
    expect(canTransitionPresentation('answered', 'sent')).toBe(false)
    expect(canTransitionPresentation(null, 'under_review')).toBe(false)
  })
})

describe('missingPresentationData (R-#161)', () => {
  const complete = {
    first_year_budget: 500,
    budget_draft_path: 'cluster/3/budget.pdf',
    director_offer_path: 'cluster/3/director.pdf',
    director_first_year_pay: 180,
    director_first_year_hours: 320,
  }

  it('reports nothing when the five data are present', () => {
    expect(missingPresentationData(complete)).toEqual([])
  })

  it('lists each missing field with its stable key', () => {
    expect(missingPresentationData({})).toEqual([
      'budget_total',
      'budget_pdf',
      'director_offer_pdf',
      'director_pay',
      'director_hours',
    ])
    expect(missingPresentationData({ ...complete, first_year_budget: 0 })).toEqual(['budget_total'])
  })
})
