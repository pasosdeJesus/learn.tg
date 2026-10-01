import { describe, it, expect } from 'vitest'
import {
  availableGuides,
  checkSignal,
  courseProgress,
  type ProgressSignalInput,
} from '../course-progress'

const base: ProgressSignalInput = {
  totalGuides: 4,
  completedGuides: 0,
  paidGuidesUSDT: 0,
  paidGuidesSLEARN: 0,
  vaultBalance: null,
  vaultBalanceSlearn: null,
  amountPerGuide: null,
  amountPerGuideSlearn: null,
}

function byKey(input: ProgressSignalInput, key: 'check' | 'usdt' | 'slearn') {
  const signal = courseProgress(input).find((s) => s.key === key)
  if (!signal) throw new Error(`missing signal ${key}`)
  return signal
}

describe('availableGuides', () => {
  it('caps at the guides still unclaimed', () => {
    expect(availableGuides(100, 1, 1)).toBe(1)
  })

  it('floors the balance into whole guides', () => {
    expect(availableGuides(9.9, 2, 10)).toBe(4)
  })

  it('is 0 with a null vault, a null amount or nothing left', () => {
    expect(availableGuides(null, 1, 4)).toBe(0)
    expect(availableGuides(4, null, 4)).toBe(0)
    expect(availableGuides(4, 1, 0)).toBe(0)
    expect(availableGuides(4, 0, 4)).toBe(0)
  })
})

describe('check circle', () => {
  it('is green when every guide is completed', () => {
    const signal = checkSignal({ ...base, completedGuides: 4 })
    expect(signal.state).toBe('done')
    expect(signal.color).toBe('green')
    expect(signal.ratio).toBe(1)
  })

  it('is yellow while some guide is pending (never gray)', () => {
    const signal = checkSignal({ ...base, completedGuides: 1 })
    expect(signal.state).toBe('available')
    expect(signal.color).toBe('yellow')
    expect(signal.ratio).toBe(0.25)
  })

  it('stays yellow even with no vault and no connection', () => {
    const signal = checkSignal({ ...base, completedGuides: 1, offline: true })
    expect(signal.color).toBe('yellow')
  })

  it('is gray with 0 guides and does not divide by zero', () => {
    const signal = checkSignal({ ...base, totalGuides: 0, completedGuides: 0 })
    expect(signal.state).toBe('blocked')
    expect(signal.color).toBe('gray')
    expect(signal.ratio).toBe(0)
  })
})

describe('usdt / slearn circles', () => {
  it('is yellow when unclaimed work can still be paid', () => {
    const signal = byKey({ ...base, paidGuidesUSDT: 1, vaultBalance: 4, amountPerGuide: 1 }, 'usdt')
    expect(signal.state).toBe('available')
    expect(signal.color).toBe('yellow')
    expect(signal.ratio).toBe(0.25)
  })

  it('is gray when the vault cannot pay now', () => {
    const signal = byKey({ ...base, paidGuidesUSDT: 1, vaultBalance: 0, amountPerGuide: 1 }, 'usdt')
    expect(signal.state).toBe('blocked')
    expect(signal.color).toBe('gray')
  })

  it('is gray without a vault balance', () => {
    const signal = byKey({ ...base, paidGuidesUSDT: 1 }, 'usdt')
    expect(signal.color).toBe('gray')
  })

  it('is green when every guide is paid, even with an empty vault', () => {
    const signal = byKey(
      { ...base, paidGuidesUSDT: 4, vaultBalance: 0, amountPerGuide: 1 },
      'usdt',
    )
    expect(signal.state).toBe('done')
    expect(signal.color).toBe('green')
    expect(signal.ratio).toBe(1)
  })

  it('applies the same rules to SLEARN', () => {
    const available = byKey(
      { ...base, paidGuidesSLEARN: 2, vaultBalanceSlearn: 10, amountPerGuideSlearn: 2 },
      'slearn',
    )
    expect(available.color).toBe('yellow')
    expect(available.ratio).toBe(0.5)

    const done = byKey({ ...base, paidGuidesSLEARN: 4 }, 'slearn')
    expect(done.color).toBe('green')
  })

  it('offline: only green or gray, never yellow', () => {
    const signal = byKey(
      { ...base, paidGuidesUSDT: 1, vaultBalance: 4, amountPerGuide: 1, offline: true },
      'usdt',
    )
    expect(signal.state).toBe('blocked')
    expect(signal.color).toBe('gray')
  })

  it('offline keeps green when everything was already paid', () => {
    const signal = byKey({ ...base, paidGuidesSLEARN: 4, offline: true }, 'slearn')
    expect(signal.color).toBe('green')
  })
})

describe('courseProgress', () => {
  it('returns the three signals in order', () => {
    expect(courseProgress(base).map((s) => s.key)).toEqual(['check', 'usdt', 'slearn'])
  })

  it('clamps a ratio above 1', () => {
    const signal = checkSignal({ ...base, completedGuides: 9 })
    expect(signal.ratio).toBe(1)
  })
})
