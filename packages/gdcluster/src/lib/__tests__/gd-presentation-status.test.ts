import { describe, it, expect } from 'vitest'
import {
  canTransitionPresentation,
  clusterDonationsOpen,
  clusterFundOpen,
  missingPresentationData,
  presentationFieldsLocked,
} from '../gd-presentation.js'

// Reglas de la presentación a Global Disciples (R-#161): qué estados bloquean los datos
// del presupuesto/director, qué transiciones acepta pdJ y qué falta para poder pedirla.

describe('presentationFieldsLocked (R-#161)', () => {
  it('locks the five fields while the request is in flight or with GD', () => {
    for (const status of ['requested', 'under_review', 'sent', 'answered']) {
      expect(presentationFieldsLocked(status)).toBe(true)
    }
  })

  it('keeps the fields editable while the cluster prepares them, after a return or after cancelling', () => {
    for (const status of [
      null,
      undefined,
      'forming',
      'wallet_approved',
      'waiting_for_budget',
      'waiting_for_pd_job_offer',
      'returned',
      'cancelled',
    ]) {
      expect(presentationFieldsLocked(status)).toBe(false)
    }
  })
})

describe('canTransitionPresentation (R-#161)', () => {
  it('follows the pipeline from the wallet approval to the answer', () => {
    expect(canTransitionPresentation('forming', 'wallet_approved')).toBe(true)
    expect(canTransitionPresentation('wallet_approved', 'waiting_for_budget')).toBe(true)
    expect(canTransitionPresentation('waiting_for_budget', 'waiting_for_pd_job_offer')).toBe(true)
    expect(canTransitionPresentation('waiting_for_pd_job_offer', 'requested')).toBe(true)
    expect(canTransitionPresentation('requested', 'under_review')).toBe(true)
    expect(canTransitionPresentation('under_review', 'returned')).toBe(true)
    expect(canTransitionPresentation('returned', 'requested')).toBe(true)
    expect(canTransitionPresentation('under_review', 'sent')).toBe(true)
    expect(canTransitionPresentation('sent', 'answered')).toBe(true)
  })

  it('has no approved state any more: pdJ sends from under_review or returned', () => {
    expect(canTransitionPresentation('under_review', 'approved')).toBe(false)
    expect(canTransitionPresentation('returned', 'approved')).toBe(false)
  })

  it('rejects skipping steps and leaving a terminal state', () => {
    expect(canTransitionPresentation('requested', 'answered')).toBe(false)
    expect(canTransitionPresentation('requested', 'sent')).toBe(false)
    expect(canTransitionPresentation('forming', 'requested')).toBe(false)
    expect(canTransitionPresentation('answered', 'sent')).toBe(false)
    expect(canTransitionPresentation(null, 'under_review')).toBe(false)
  })
})

describe('clusterFundOpen (R-#161, REQ/161 §4.7)', () => {
  it('opens the cluster fund only while the wallet is approved and the fund was not released', () => {
    for (const status of ['wallet_approved', 'waiting_for_budget', 'waiting_for_pd_job_offer', 'requested', 'under_review', 'returned', 'sent']) {
      expect(clusterFundOpen(status, null)).toBe(true)
    }
    for (const status of ['forming', 'answered', 'cancelled', null, undefined]) {
      expect(clusterFundOpen(status, null)).toBe(false)
    }
    expect(clusterFundOpen('sent', new Date())).toBe(false)
  })

  it('closes donations once the cluster is with Global Disciples', () => {
    expect(clusterDonationsOpen('wallet_approved', null)).toBe(true)
    expect(clusterDonationsOpen('requested', null)).toBe(true)
    expect(clusterDonationsOpen('sent', null)).toBe(false)
    expect(clusterDonationsOpen('answered', null)).toBe(false)
  })
})

describe('missingPresentationData (R-#161)', () => {
  const complete = {
    fourth_year_budget: 500,
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
    expect(missingPresentationData({ ...complete, fourth_year_budget: 0 })).toEqual(['budget_total'])
  })
})
