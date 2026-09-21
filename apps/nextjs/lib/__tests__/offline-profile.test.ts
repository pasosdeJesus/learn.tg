import { describe, it, expect, beforeEach } from 'vitest'
import {
  MIN_PROFILE_SCORE_FOR_SCHOLARSHIP,
  getProfileScore,
  getProfileScoreSavedAt,
  profileScoreBelowMinimum,
  saveProfileScore,
} from '../offline-profile'

describe('offline-profile (R-#242)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null when nothing was saved', () => {
    expect(getProfileScore()).toBeNull()
    expect(getProfileScoreSavedAt()).toBeNull()
    expect(profileScoreBelowMinimum()).toBe(false)
  })

  it('saves the last known profile score', () => {
    saveProfileScore(75)
    expect(getProfileScore()).toBe(75)
    expect(getProfileScoreSavedAt()).toBeGreaterThan(0)
  })

  it('accepts a numeric string (the API sends numbers as JSON)', () => {
    saveProfileScore('42')
    expect(getProfileScore()).toBe(42)
  })

  it('ignores values that are not a number', () => {
    saveProfileScore('nope')
    expect(getProfileScore()).toBeNull()
    saveProfileScore(null)
    expect(getProfileScore()).toBeNull()
  })

  it('flags a score below the scholarship minimum, and only then', () => {
    saveProfileScore(MIN_PROFILE_SCORE_FOR_SCHOLARSHIP - 1)
    expect(profileScoreBelowMinimum()).toBe(true)
    saveProfileScore(MIN_PROFILE_SCORE_FOR_SCHOLARSHIP)
    expect(profileScoreBelowMinimum()).toBe(false)
    saveProfileScore(93)
    expect(profileScoreBelowMinimum()).toBe(false)
  })
})
