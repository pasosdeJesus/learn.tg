import { beforeEach, describe, expect, it } from 'vitest'
import {
  USER_VERIFICATION_GRACE_MS,
  clearUserVerification,
  hasRecentUserVerification,
  markUserVerified,
} from '../web-authn'

describe('user verification grace window (R-#246, decision 2026-09-20)', () => {
  beforeEach(() => clearUserVerification())

  it('defaults to 15 minutes', () => {
    expect(USER_VERIFICATION_GRACE_MS).toBe(15 * 60 * 1000)
  })

  it('is false before any verification', () => {
    expect(hasRecentUserVerification()).toBe(false)
  })

  it('is true right after a verification and just inside the window', () => {
    markUserVerified(1000)
    expect(hasRecentUserVerification(USER_VERIFICATION_GRACE_MS, 1000)).toBe(true)
    expect(
      hasRecentUserVerification(USER_VERIFICATION_GRACE_MS, 1000 + USER_VERIFICATION_GRACE_MS - 1),
    ).toBe(true)
  })

  it('expires once the window is over', () => {
    markUserVerified(1000)
    expect(
      hasRecentUserVerification(USER_VERIFICATION_GRACE_MS, 1000 + USER_VERIFICATION_GRACE_MS),
    ).toBe(false)
  })

  it('is cleared on lock/delete', () => {
    markUserVerified(1000)
    clearUserVerification()
    expect(hasRecentUserVerification(USER_VERIFICATION_GRACE_MS, 1000)).toBe(false)
  })
})
