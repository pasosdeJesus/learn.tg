import { describe, expect, it } from 'vitest'
import {
  TOKEN_DECIMALS,
  explorerTxUrl,
  formatTokenAmount,
  parseTokenAmount,
  shortAddress,
  validateSend,
} from '../wallet-amounts'

const SELF = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const OTHER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'

describe('wallet-amounts (R-#249)', () => {
  it('formats with the token decimals and trims zeros', () => {
    expect(formatTokenAmount(1_000_000n, TOKEN_DECIMALS.USDT)).toBe('1')
    expect(formatTokenAmount(1_500_000n, TOKEN_DECIMALS.USDT)).toBe('1.5')
    expect(formatTokenAmount(123n, TOKEN_DECIMALS.SLEARN)).toBe('1.23')
    expect(formatTokenAmount(0n, TOKEN_DECIMALS.CELO)).toBe('0')
    expect(formatTokenAmount(null, 18)).toBe('—')
  })

  it('parses amounts into base units and rejects impossible ones', () => {
    expect(parseTokenAmount('1', 6)).toBe(1_000_000n)
    expect(parseTokenAmount('0,5', 6)).toBe(500_000n)
    expect(parseTokenAmount('1.234567', 6)).toBe(1_234_567n)
    // Más decimales que el token: se rechaza en vez de redondear en silencio.
    expect(parseTokenAmount('0.0000001', 6)).toBeNull()
    expect(parseTokenAmount('0', 6)).toBeNull()
    expect(parseTokenAmount('abc', 6)).toBeNull()
    expect(parseTokenAmount('', 6)).toBeNull()
  })

  it('shortens addresses like the rest of the app', () => {
    expect(shortAddress(SELF)).toBe('0xf39F…2266')
    expect(shortAddress('')).toBe('')
  })

  it('builds explorer links per network', () => {
    expect(explorerTxUrl('0xabc', 'celo')).toBe('https://celo.blockscout.com/tx/0xabc')
    expect(explorerTxUrl('0xabc', 'celoSepolia')).toContain('celo-sepolia')
  })

  it('validates a send before signing', () => {
    const base = { to: OTHER, amount: 1_000_000n, balance: 2_000_000n, isNative: false } as const
    expect(validateSend({ ...base, selfAddress: SELF })).toBeNull()
    expect(validateSend({ ...base, to: 'no-es-direccion', selfAddress: SELF })).toBe('invalid-address')
    expect(validateSend({ ...base, to: SELF, selfAddress: SELF })).toBe('self')
    expect(validateSend({ ...base, amount: null, selfAddress: SELF })).toBe('invalid-amount')
    expect(validateSend({ ...base, balance: 0n, selfAddress: SELF })).toBe('insufficient')
    // CELO nativo: el monto debe dejar espacio para el gas.
    expect(
      validateSend({ to: OTHER, amount: 1_000_000n, balance: 1_000_000n, isNative: true, gasCost: 21_000n }),
    ).toBe('no-gas')
    expect(
      validateSend({ to: OTHER, amount: 900_000n, balance: 1_000_000n, isNative: true, gasCost: 21_000n }),
    ).toBeNull()
  })

  it('rejects a mixed-case address with a bad checksum', () => {
    // Misma dirección con una letra en mayúscula cambiada.
    const broken = `${OTHER.slice(0, -1)}${OTHER.slice(-1) === 'A' ? 'B' : 'A'}`
    expect(validateSend({ to: broken, amount: 1n, balance: 2n, isNative: false })).toBe('invalid-address')
  })
})
