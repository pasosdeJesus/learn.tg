import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { toFunctionSelector } from 'viem'
import {
  GOODDOLLAR_ADDRESSES,
  GOODDOLLAR_CHAIN_ID,
  GOODDOLLAR_FV_MESSAGE,
  GOODDOLLAR_G_DECIMALS,
  GOODDOLLAR_SELECTORS,
  GOODDOLLAR_SUPPORTED_CHAIN_IDS,
  buildGoodIdVerificationUrl,
  detectProtocolChange,
  goodDollarFvMessage,
  goodDollarProtocolSignature,
  parseGoodIdReturn,
  resolveGoodDollarAction,
} from '../gooddollar-protocol'

// El SDK oficial instalado es la referencia: si GoodDollar redespliega, cambia el
// mensaje de verificación o los decimales, estas pruebas FALLAN y nos avisan.
const require = createRequire(import.meta.url)
const sdk = require('@goodsdks/citizen-sdk')

describe('gooddollar-protocol / contraste con el SDK oficial', () => {
  it('las direcciones de Celo mainnet son las del SDK', () => {
    const official = sdk.chainConfigs[GOODDOLLAR_CHAIN_ID].contracts.production
    expect(GOODDOLLAR_ADDRESSES.identity.toLowerCase()).toBe(official.identityContract.toLowerCase())
    expect(GOODDOLLAR_ADDRESSES.ubi.toLowerCase()).toBe(official.ubiContract.toLowerCase())
    expect(GOODDOLLAR_ADDRESSES.gDollar.toLowerCase()).toBe(official.g$Contract.toLowerCase())
  })

  it('la cadena y los decimales son los del SDK', () => {
    expect(sdk.CHAIN_DECIMALS[GOODDOLLAR_CHAIN_ID]).toBe(GOODDOLLAR_G_DECIMALS)
    expect([...sdk.SUPPORTED_CHAIN_IDS].sort()).toEqual([...GOODDOLLAR_SUPPORTED_CHAIN_IDS].sort())
  })

  it('el mensaje de verificación es el del SDK (plantilla con <account>)', () => {
    expect(sdk.FV_IDENTIFIER_MSG2).toBe(GOODDOLLAR_FV_MESSAGE)
    expect(goodDollarFvMessage('0xABC')).toContain('0xABC')
    expect(goodDollarFvMessage('0xABC')).not.toContain('<account>')
  })

  it('los selectores corresponden a las firmas y `claim()` es el de la tx real', () => {
    expect(toFunctionSelector('claim()')).toBe(GOODDOLLAR_SELECTORS.claim)
    expect(toFunctionSelector('getWhitelistedRoot(address)')).toBe(GOODDOLLAR_SELECTORS.getWhitelistedRoot)
    expect(toFunctionSelector('checkEntitlement(address)')).toBe(GOODDOLLAR_SELECTORS.checkEntitlement)
    expect(toFunctionSelector('paused()')).toBe(GOODDOLLAR_SELECTORS.paused)
    // Confirmado en la transacción 0x31d264ee… de Celo mainnet.
    expect(GOODDOLLAR_SELECTORS.claim).toBe('0x4e71d92d')
  })
})

describe('detectProtocolChange', () => {
  const ok = {
    chainId: GOODDOLLAR_CHAIN_ID,
    identityHasCode: true,
    ubiHasCode: true,
    ubiPaused: false,
    gDecimals: 18,
  }

  it('no reporta nada cuando todo está en orden', () => {
    expect(detectProtocolChange(ok)).toEqual([])
  })

  it('detecta cadena no soportada, contratos ausentes, pausa y decimales distintos', () => {
    expect(detectProtocolChange({ ...ok, chainId: 1 })).toHaveLength(1)
    expect(detectProtocolChange({ ...ok, identityHasCode: false })).toHaveLength(1)
    expect(detectProtocolChange({ ...ok, ubiHasCode: false })).toHaveLength(1)
    expect(detectProtocolChange({ ...ok, ubiPaused: true })).toHaveLength(1)
    expect(detectProtocolChange({ ...ok, gDecimals: 2 })[0]).toMatch(/decimales/)
  })
})

describe('resolveGoodDollarAction', () => {
  it('reclama directo si está whitelisteada y hay beca', () => {
    expect(resolveGoodDollarAction({ chainId: 42220, whitelisted: true, entitlement: 1n })).toBe('direct-claim')
  })

  it('pide verificar si no está whitelisteada', () => {
    expect(resolveGoodDollarAction({ chainId: 42220, whitelisted: false, entitlement: 0n })).toBe('verify')
  })

  it('no hace nada si ya reclamó hoy', () => {
    expect(resolveGoodDollarAction({ chainId: 42220, whitelisted: true, entitlement: 0n })).toBe('nothing-today')
  })

  it('no soporta otra cadena', () => {
    expect(resolveGoodDollarAction({ chainId: 11142220, whitelisted: true, entitlement: 5n })).toBe('unsupported-chain')
  })
})

describe('enlace de verificación y regreso', () => {
  it('arma el enlace de GoodID como GoodWallet', () => {
    const url = buildGoodIdVerificationUrl({
      account: '0x2e2c4AC19c93d0984840cDD8E7f77500e2ef978e',
      chainId: 42220,
      fvsig: '0xdeadbeef',
      firstname: 'Ana',
      returnUrl: 'https://learn.tg/en/web3-and-ubi/guide4',
    })
    const p = new URL(url)
    expect(p.origin + p.pathname).toBe('https://goodid.gooddollar.org/')
    expect(p.searchParams.get('account')).toBe('0x2e2c4AC19c93d0984840cDD8E7f77500e2ef978e')
    expect(p.searchParams.get('chain')).toBe('42220')
    expect(p.searchParams.get('fvsig')).toBe('0xdeadbeef')
    expect(p.searchParams.get('isDelta')).toBe('true')
    expect(p.searchParams.get('rdu')).toContain('/en/web3-and-ubi/guide4')
  })

  it('lee el regreso verificado y el motivo del fallo', () => {
    expect(parseGoodIdReturn('https://learn.tg/en/x?verified=true&chain=42220')).toEqual({
      verified: true, reason: null, chainId: 42220,
    })
    expect(parseGoodIdReturn('https://learn.tg/en/x?verified=false&reason=Nope&chain=42220').verified).toBe(false)
    expect(parseGoodIdReturn('https://learn.tg/en/x?verified=false&reason=Nope').reason).toBe('Nope')
  })
})

describe('goodDollarProtocolSignature', () => {
  it('cambia si cambia un valor vigilado', () => {
    const s = goodDollarProtocolSignature()
    expect(s).toContain(GOODDOLLAR_ADDRESSES.ubi)
    expect(s).toContain('decimals:18')
  })
})
