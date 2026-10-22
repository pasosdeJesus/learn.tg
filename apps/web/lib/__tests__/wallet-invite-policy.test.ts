import { describe, it, expect } from 'vitest'
import { canInviteWallet, isVerifiedAccount, INVITER_MIN_PROFILE_SCORE } from '@/lib/wallet-invite-policy'

// R-#265 §3.2 / m#50 §7: "solo usuarios verificados pueden invitar"; en learn.tg la barra
// es el puntaje de perfil (el mismo que exigen las recompensas on-chain).
describe('canInviteWallet (R-#265 §3.2)', () => {
  it('allows a profile at or above the bar', () => {
    expect(canInviteWallet({ profilescore: INVITER_MIN_PROFILE_SCORE })).toEqual({
      allowed: true,
      profileScore: INVITER_MIN_PROFILE_SCORE,
    })
    expect(canInviteWallet({ profilescore: 100 }).allowed).toBe(true)
  })

  it('rejects a profile below the bar', () => {
    expect(canInviteWallet({ profilescore: INVITER_MIN_PROFILE_SCORE - 1 })).toEqual({
      allowed: false,
      reason: 'profile-score',
      profileScore: INVITER_MIN_PROFILE_SCORE - 1,
    })
  })

  it('treats a missing or null score as zero', () => {
    expect(canInviteWallet(null)).toEqual({ allowed: false, reason: 'profile-score', profileScore: 0 })
    expect(canInviteWallet({ profilescore: null })).toEqual({
      allowed: false,
      reason: 'profile-score',
      profileScore: 0,
    })
    expect(canInviteWallet(undefined).allowed).toBe(false)
  })
})

// R-#265 §3.2 (2026-10-21): una cuenta nueva puede invitar una billetera que ya
// pertenece a una cuenta verificada; la invitada firma el `accept`.
describe('canInviteWallet con billetera invitada verificada', () => {
  it('allows a low-score inviter when the invitee account is verified by score', () => {
    expect(
      canInviteWallet({ profilescore: 10 }, { profilescore: INVITER_MIN_PROFILE_SCORE }),
    ).toEqual({ allowed: true, profileScore: 10 })
  })

  it('allows when the invitee has a Self passport or church verification', () => {
    expect(canInviteWallet({ profilescore: 0 }, { passport_name: 'Ana' }).allowed).toBe(true)
    expect(
      canInviteWallet({ profilescore: 0 }, { verified_church_relationship: 'pastor' }).allowed,
    ).toBe(true)
  })

  it('keeps rejecting when neither the inviter nor the invitee is verified', () => {
    expect(canInviteWallet({ profilescore: 10 }, { profilescore: 10 })).toEqual({
      allowed: false,
      reason: 'profile-score',
      profileScore: 10,
    })
    expect(canInviteWallet({ profilescore: 10 }, null).allowed).toBe(false)
  })

  it('isVerifiedAccount ignores blank passports and null accounts', () => {
    expect(isVerifiedAccount(null)).toBe(false)
    expect(isVerifiedAccount({ profilescore: 0, passport_name: '   ' })).toBe(false)
    expect(isVerifiedAccount({ profilescore: 0, passport_name: 'Ana' })).toBe(true)
  })
})
