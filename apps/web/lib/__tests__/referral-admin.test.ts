// Referrer read/correction from the admin UI
// (https://github.com/pasosdeJesus/learn.tg/issues/163).
import { describe, it, expect, beforeEach } from 'vitest'
import { apiDbMocks } from '@pasosdejesus/m/test-utils/kysely-mocks'

import { getReferralInfo, setReferrer } from '../referral-admin'

const { mockExecuteTakeFirst, mockExecute, resetMocks, setupCommonResponses, MockKysely } = apiDbMocks

function db() {
  return new MockKysely() as any
}

describe('getReferralInfo', () => {
  beforeEach(() => {
    resetMocks()
    setupCommonResponses()
  })

  it('returns the user code, the referrer and the rewards already paid to that referrer', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce({ code: 'ABC123' }) // referralcode
      .mockResolvedValueOnce({
        referrer_id: 5, referral_claimed_at: '2026-09-13T10:00:00Z',
        nusuario: 'juan', nombre: 'Juan Perez',
      })
    mockExecute.mockResolvedValueOnce([
      { crypto: 'usdt', amount: '0.10' },
      { crypto: 'slearn', amount: '0.20' },
    ])

    const info = await getReferralInfo(db(), 42)

    expect(info.code).toBe('ABC123')
    expect(info.referrer).toEqual({ id: 5, nusuario: 'juan', nombre: 'Juan Perez' })
    expect(info.rewards_paid.count).toBe(2)
    expect(info.rewards_paid.usdt).toBeCloseTo(0.1)
    expect(info.rewards_paid.slearn).toBeCloseTo(0.2)
  })

  it('returns empty values for a user with no code and no referrer', async () => {
    mockExecuteTakeFirst.mockResolvedValue(null)

    const info = await getReferralInfo(db(), 42)

    expect(info).toEqual({
      code: null, referrer: null, claimed_at: null,
      rewards_paid: { count: 0, usdt: 0, slearn: 0 },
    })
  })
})

describe('setReferrer', () => {
  beforeEach(() => {
    resetMocks()
    setupCommonResponses()
  })

  it('clears the referrer when the input is empty', async () => {
    mockExecuteTakeFirst.mockResolvedValueOnce({ referrer_id: 5 }) // existing relationship
    mockExecute.mockResolvedValueOnce([])

    const result = await setReferrer(db(), 42, '  ')

    expect(result).toEqual({ ok: true, referrerId: null, changed: true })
    expect(mockExecute).toHaveBeenCalled()
  })

  it('does nothing when clearing a user that has no referrer', async () => {
    mockExecuteTakeFirst.mockResolvedValueOnce(null)

    const result = await setReferrer(db(), 42, null)

    expect(result).toEqual({ ok: true, referrerId: null, changed: false })
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it('resolves the referrer by referral code and creates the relationship', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce(null) // no current relationship
      .mockResolvedValueOnce({ usuario_id: 9 }) // referralcode lookup
      .mockResolvedValueOnce({ code: 'CODE9' }) // code stored in the new relationship
    mockExecute
      .mockResolvedValueOnce([
        { id: 9, fechacreacion: '2026-01-01T00:00:00Z' },
        { id: 42, fechacreacion: '2026-02-01T00:00:00Z' },
      ])
      .mockResolvedValueOnce([])

    const result = await setReferrer(db(), 42, 'code9')

    expect(result).toEqual({ ok: true, referrerId: 9, changed: true })
  })

  it('resolves the referrer by user id, without a username lookup', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ code: 'CODE9' })
    mockExecute
      .mockResolvedValueOnce([
        { id: 9, fechacreacion: '2026-01-01T00:00:00Z' },
        { id: 42, fechacreacion: '2026-02-01T00:00:00Z' },
      ])
      .mockResolvedValueOnce([])

    const result = await setReferrer(db(), 42, '#9')

    expect(result).toEqual({ ok: true, referrerId: 9, changed: true })
  })

  it('rejects a self-referral', async () => {
    mockExecuteTakeFirst.mockResolvedValueOnce(null)

    const result = await setReferrer(db(), 42, '42')

    expect(result).toEqual({ ok: false, error: 'A user cannot refer themselves' })
  })

  it('rejects an unknown referrer (id, username and code all miss)', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce(null) // no current relationship
      .mockResolvedValueOnce(null) // no code
      .mockResolvedValueOnce(null) // no username

    const result = await setReferrer(db(), 42, 'nadie')

    expect(result.ok).toBe(false)
    expect((result as { error: string }).error).toContain('Referrer not found')
  })

  it('rejects a referrer account newer than the referred user', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 9 }) // by username
    mockExecute.mockResolvedValueOnce([
      { id: 9, fechacreacion: '2026-03-01T00:00:00Z' },
      { id: 42, fechacreacion: '2026-02-01T00:00:00Z' },
    ])

    const result = await setReferrer(db(), 42, 'juan')

    expect(result).toEqual({ ok: false, error: 'The referrer account is newer than the referred user' })
  })

  it('reports no change when the referrer is the one already stored', async () => {
    mockExecuteTakeFirst.mockResolvedValueOnce({ referrer_id: 9 })

    const result = await setReferrer(db(), 42, '9')

    expect(result).toEqual({ ok: true, referrerId: 9, changed: false })
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it('updates the relationship when the referrer changes', async () => {
    mockExecuteTakeFirst
      .mockResolvedValueOnce({ referrer_id: 5 }) // current
    mockExecute
      .mockResolvedValueOnce([
        { id: 9, fechacreacion: '2026-01-01T00:00:00Z' },
        { id: 42, fechacreacion: '2026-02-01T00:00:00Z' },
      ])
      .mockResolvedValueOnce([])

    const result = await setReferrer(db(), 42, '9')

    expect(result).toEqual({ ok: true, referrerId: 9, changed: true })
    expect(mockExecute).toHaveBeenCalledTimes(2) // the update, not an insert
  })
})
