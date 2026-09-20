import { beforeEach, describe, expect, it } from 'vitest'
import { clearDestinations, isKnownDestination, rememberDestination } from '../destinations'

const WALLET = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const OTHER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'

describe('destinations (R-#253)', () => {
  beforeEach(() => clearDestinations())

  it('treats an unseen address as new', () => {
    expect(isKnownDestination(WALLET, OTHER)).toBe(false)
  })

  it('remembers an address, case-insensitively', () => {
    rememberDestination(WALLET, OTHER)
    expect(isKnownDestination(WALLET, OTHER)).toBe(true)
    expect(isKnownDestination(WALLET, OTHER.toLowerCase())).toBe(true)
  })

  it('keeps the list per wallet', () => {
    rememberDestination(WALLET, OTHER)
    expect(isKnownDestination('0x0000000000000000000000000000000000000001', OTHER)).toBe(false)
  })

  it('is false for empty input', () => {
    expect(isKnownDestination('', OTHER)).toBe(false)
    expect(isKnownDestination(WALLET, '')).toBe(false)
  })

  it('clears one wallet without touching the others', () => {
    rememberDestination(WALLET, OTHER)
    rememberDestination('0x0000000000000000000000000000000000000001', OTHER)
    clearDestinations(WALLET)
    expect(isKnownDestination(WALLET, OTHER)).toBe(false)
    expect(isKnownDestination('0x0000000000000000000000000000000000000001', OTHER)).toBe(true)
  })
})
