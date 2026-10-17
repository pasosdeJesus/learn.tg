import { describe, it, expect } from 'vitest'
import { canInviteWallet, INVITER_MIN_PROFILE_SCORE } from '@/lib/wallet-invite-policy'

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
