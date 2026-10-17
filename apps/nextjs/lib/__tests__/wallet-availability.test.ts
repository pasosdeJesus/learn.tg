import { describe, expect, it } from 'vitest'
import { hasAnotherWallet } from '../wallet-availability'

const A = '0x' + 'a'.repeat(40)
const B = '0x' + 'b'.repeat(40)

describe('hasAnotherWallet (R-#265)', () => {
  it('una sola billetera externa conectada no cuenta como otra', () => {
    expect(hasAnotherWallet({
      sessionAddress: A,
      hasInAppWallet: false,
      externalAvailable: true,
      externalAccounts: [A],
      announcedCount: 1,
    })).toBe(false)
  })

  it('la billetera de la aplicación cuenta si no es la de la sesión', () => {
    expect(hasAnotherWallet({
      sessionAddress: A,
      inAppAddress: B,
      hasInAppWallet: true,
      externalAvailable: false,
    })).toBe(true)
  })

  it('la billetera de la aplicación con la misma dirección no cuenta', () => {
    expect(hasAnotherWallet({
      sessionAddress: A,
      inAppAddress: A,
      hasInAppWallet: true,
      externalAvailable: false,
    })).toBe(false)
  })

  it('otra cuenta permitida en la billetera externa cuenta', () => {
    expect(hasAnotherWallet({
      sessionAddress: A,
      hasInAppWallet: false,
      externalAvailable: true,
      externalAccounts: [A, B],
      announcedCount: 1,
    })).toBe(true)
  })

  it('dos proveedores anunciados cuentan', () => {
    expect(hasAnotherWallet({
      sessionAddress: A,
      hasInAppWallet: false,
      externalAvailable: true,
      externalAccounts: [A],
      announcedCount: 2,
    })).toBe(true)
  })

  it('sesión con la billetera de la aplicación + externa sin permiso todavía', () => {
    expect(hasAnotherWallet({
      sessionAddress: A,
      inAppAddress: A,
      hasInAppWallet: true,
      externalAvailable: true,
      externalAccounts: [],
    })).toBe(true)
  })

  it('sin sesión no hay nada que vincular', () => {
    expect(hasAnotherWallet({
      sessionAddress: null,
      hasInAppWallet: true,
      inAppAddress: B,
      externalAvailable: true,
    })).toBe(false)
  })
})
