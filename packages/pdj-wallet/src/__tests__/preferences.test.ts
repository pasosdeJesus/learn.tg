import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearUnlockPreference,
  getUnlockPreference,
  setUnlockPreference,
} from '../preferences'

/** Minimal localStorage stub (the package tests run in a Node environment). */
function installStorage(store: Map<string, string>): void {
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value) },
    removeItem: (key: string) => { store.delete(key) },
  })
}

describe('unlock preference (R-#246 §14 item 2)', () => {
  let store: Map<string, string>

  beforeEach(() => {
    store = new Map()
    installStorage(store)
  })

  it('has no preference by default', () => {
    expect(getUnlockPreference()).toBeNull()
  })

  it('remembers that the user prefers the password', () => {
    setUnlockPreference('password')
    expect(getUnlockPreference()).toBe('password')
    expect(store.get('pdj-wallet:unlockPreference')).toBe('password')
  })

  it('remembers the gesture and can forget it', () => {
    setUnlockPreference('biometric')
    expect(getUnlockPreference()).toBe('biometric')
    clearUnlockPreference()
    expect(getUnlockPreference()).toBeNull()
  })

  it('ignores a value it does not understand', () => {
    store.set('pdj-wallet:unlockPreference', 'whatever')
    expect(getUnlockPreference()).toBeNull()
  })

  it('never throws when storage is unavailable', () => {
    vi.unstubAllGlobals()
    expect(getUnlockPreference()).toBeNull()
    expect(() => setUnlockPreference('password')).not.toThrow()
    expect(() => clearUnlockPreference()).not.toThrow()
  })
})
