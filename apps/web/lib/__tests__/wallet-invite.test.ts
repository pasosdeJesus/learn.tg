import { describe, it, expect, vi } from 'vitest'
import { canInviteAddress, lookupInviteeTrust } from '@/lib/wallet-invite'

/**
 * Stub mínimo de Kysely para la consulta de la billetera invitada. Captura el filtro
 * para comprobar que se normaliza la dirección a minúsculas.
 */
function fakeDb(row: Record<string, unknown> | undefined) {
  const where = vi.fn()
  const builder = {
    selectFrom: vi.fn(() => builder),
    innerJoin: vi.fn(() => builder),
    select: vi.fn(() => builder),
    where: vi.fn((column: string, op: string, value: unknown) => {
      where(column, op, value)
      return builder
    }),
    executeTakeFirst: vi.fn(async () => row),
  }
  return { db: builder as any, where }
}

describe('lookupInviteeTrust', () => {
  it('queries the account behind the address and lowercases it', async () => {
    const { db, where } = fakeDb({
      profilescore: 60,
      passport_name: null,
      verified_church_relationship: null,
    })

    const trust = await lookupInviteeTrust(db, '0xABCDEF0000000000000000000000000000000001')

    expect(trust).toEqual({
      profilescore: 60,
      passport_name: null,
      verified_church_relationship: null,
    })
    expect(where).toHaveBeenCalledWith(
      'bu.billetera',
      '=',
      '0xabcdef0000000000000000000000000000000001',
    )
  })

  it('returns null when the address has no account', async () => {
    const { db } = fakeDb(undefined)
    expect(await lookupInviteeTrust(db, '0xabc')).toBeNull()
  })
})

describe('canInviteAddress (R-#265 §3.2)', () => {
  const inviteeVerified = { profilescore: 80 }

  it('allows a low-score inviter to invite a verified account wallet', async () => {
    const { db } = fakeDb(inviteeVerified)
    await expect(canInviteAddress(db, { profilescore: 5 }, '0xabc')).resolves.toEqual({
      allowed: true,
      profileScore: 5,
    })
  })

  it('still requires the inviter bar when the invitee is not verified', async () => {
    const { db } = fakeDb({ profilescore: 10 })
    await expect(canInviteAddress(db, { profilescore: 5 }, '0xabc')).resolves.toEqual({
      allowed: false,
      reason: 'profile-score',
      profileScore: 5,
    })
  })

  it('keeps the plain inviter rule when the address is new', async () => {
    const { db } = fakeDb(undefined)
    expect((await canInviteAddress(db, { profilescore: 50 }, '0xabc')).allowed).toBe(true)
    expect((await canInviteAddress(db, { profilescore: 0 }, '0xabc')).allowed).toBe(false)
  })
})
