import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BACKUP_CONFIRMED_KEY,
  isBackupConfirmed,
  markBackupConfirmed,
  pickVerifyPositions,
  verifyWords,
} from '../wallet-backup'

const PHRASE = 'legal winner thank year wave sausage worth useful legal winner thank yellow'.split(' ')

describe('wallet-backup (R-#249)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('picks three distinct positions inside the phrase, sorted', () => {
    const sequence = [0.1, 0.5, 0.9, 0.2]
    let index = 0
    const positions = pickVerifyPositions(12, 3, () => sequence[index++ % sequence.length])
    expect(positions).toHaveLength(3)
    expect(new Set(positions).size).toBe(3)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    for (const position of positions) {
      expect(position).toBeGreaterThanOrEqual(1)
      expect(position).toBeLessThanOrEqual(12)
    }
  })

  it('never asks for more words than the phrase has', () => {
    expect(pickVerifyPositions(2, 3, () => 0)).toHaveLength(2)
    expect(pickVerifyPositions(0, 3)).toHaveLength(0)
  })

  it('accepts the right words in any case and rejects the wrong ones', () => {
    const inputs = { 1: 'legal', 5: 'wave', 12: 'yellow' }
    expect(verifyWords(PHRASE, inputs)).toEqual({ ok: true, wrong: [] })
    expect(verifyWords(PHRASE, { 1: ' Legal ', 5: 'WAVE', 12: 'yellow' })).toEqual({
      ok: true,
      wrong: [],
    })
    expect(verifyWords(PHRASE, { 1: 'legal', 5: 'nottheword', 12: 'yellow' })).toEqual({
      ok: false,
      wrong: [5],
    })
    // Sin nada escrito no se puede dar por respaldada.
    expect(verifyWords(PHRASE, {}).ok).toBe(false)
    expect(verifyWords(PHRASE, { 1: '' }).ok).toBe(false)
  })

  it('remembers the confirmation without storing anything secret', () => {
    expect(isBackupConfirmed()).toBe(false)
    markBackupConfirmed()
    expect(isBackupConfirmed()).toBe(true)
    expect(localStorage.getItem(BACKUP_CONFIRMED_KEY)).toBe('1')
  })

  it('does not break when localStorage is unavailable', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(() => markBackupConfirmed()).not.toThrow()
    spy.mockRestore()
  })
})
