import { describe, it, expect } from 'vitest'
import {
  pastorMissingReasons,
  presentationMissingReasons,
  MIN_PROFILE_SCORE,
  type PastorCheck,
} from '../gd-presentation.js'

// R-#161: el 400 "not ready" no debe ser un callejón sin salida. Además de los
// códigos (`missing`, `missing_data`), la ruta devuelve los motivos en palabras y
// estas pruebas fijan ese texto.

function pastor(overrides: Partial<PastorCheck> = {}): PastorCheck {
  return {
    usuario_id: 5,
    nombre: 'Ana',
    church_id: 20,
    church_name: 'Iglesia Esperanza',
    guides_done: 6,
    guides_total: 6,
    course_completed: true,
    profile_score: 95,
    invited_pastor: true,
    invited_member: true,
    missing: [],
    ...overrides,
  }
}

describe('pastorMissingReasons (R-#161)', () => {
  it('says nothing when the pastor meets every condition', () => {
    expect(pastorMissingReasons(pastor())).toEqual([])
  })

  it('says which guide of how many is missing', () => {
    const reasons = pastorMissingReasons(
      pastor({ guides_done: 4, guides_total: 6, course_completed: false, missing: ['course'] }),
    )
    expect(reasons).toHaveLength(1)
    expect(reasons[0]).toContain('Iglesia Esperanza (Ana)')
    expect(reasons[0]).toContain('4 of 6')
    expect(reasons[0]).toContain('Global Disciples')
  })

  it('says the course was not started when there are no guides', () => {
    const reasons = pastorMissingReasons(
      pastor({ guides_done: 0, guides_total: 6, course_completed: false, missing: ['course'] }),
    )
    expect(reasons[0]).toMatch(/has not started the Global Disciples course/)
  })

  it('says the profile score and the threshold', () => {
    const reasons = pastorMissingReasons(
      pastor({ profile_score: 72, missing: ['score'] }),
    )
    expect(reasons[0]).toContain('72')
    expect(reasons[0]).toContain(String(MIN_PROFILE_SCORE))
  })

  it('says which invitations are missing', () => {
    const reasons = pastorMissingReasons(
      pastor({ invited_pastor: false, invited_member: false, missing: ['invite_pastor', 'invite_member'] }),
    )
    expect(reasons.join(' | ')).toMatch(/has not invited a pastor or co-pastor/)
    expect(reasons.join(' | ')).toMatch(/has not invited a member or leader/)
  })

  it('says when the church has no lead pastor', () => {
    const reasons = pastorMissingReasons(
      pastor({ usuario_id: 0, nombre: null, missing: ['no_pastor'] }),
    )
    expect(reasons[0]).toBe('Iglesia Esperanza: no lead pastor is registered for this church')
  })
})

describe('presentationMissingReasons (R-#161)', () => {
  it('explains each cluster level condition in words', () => {
    const reasons = presentationMissingReasons(
      {
        missing: ['cluster_active', 'cluster_members', 'no_pastors', 'cluster_wallet', 'approvals'],
        pastors: [],
        member_churches: 2,
      },
      [],
    )
    expect(reasons).toHaveLength(5)
    expect(reasons.join(' | ')).toMatch(/not active yet/)
    expect(reasons.join(' | ')).toMatch(/has 2 churches.*at least 3/)
    expect(reasons.join(' | ')).toMatch(/no church in the cluster has a lead pastor/i)
    expect(reasons.join(' | ')).toMatch(/cluster wallet/)
    expect(reasons.join(' | ')).toMatch(/approved the presentation data/)
  })

  it('adds the pastors and the missing presentation data', () => {
    const reasons = presentationMissingReasons(
      {
        missing: [],
        pastors: [
          pastor({ church_name: 'A', nombre: null, guides_done: 3, guides_total: 6, course_completed: false, missing: ['course'] }),
          pastor({ church_name: 'B', nombre: null, profile_score: 50, missing: ['score'] }),
        ],
        member_churches: 3,
      },
      ['budget_total', 'director_offer_pdf'],
    )
    expect(reasons).toHaveLength(3)
    expect(reasons[0]).toContain('A: finished 3 of 6')
    expect(reasons[1]).toContain('B: profile score is 50')
    expect(reasons[2]).toContain('the first year budget')
    expect(reasons[2]).toContain("the director's offer PDF")
  })

  it('keeps unknown data keys visible instead of dropping them', () => {
    const reasons = presentationMissingReasons({ missing: [], pastors: [] }, ['algo_nuevo'])
    expect(reasons[0]).toContain('algo_nuevo')
  })
})
