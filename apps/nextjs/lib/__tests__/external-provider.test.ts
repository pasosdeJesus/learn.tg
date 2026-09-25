// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  externalWalletSource,
  getAnnouncedProviders,
  getExternalProvider,
  resetExternalProviderForTests,
} from '@/lib/external-provider'

const PROVIDER_A = { request: vi.fn(), on: vi.fn(), removeListener: vi.fn() }
const PROVIDER_B = { request: vi.fn(), on: vi.fn(), removeListener: vi.fn() }

function announce(provider: unknown, rdns: string, name = rdns): void {
  window.dispatchEvent(
    new CustomEvent('eip6963:announceProvider', {
      detail: { info: { uuid: `${rdns}-uuid`, name, rdns }, provider },
    }),
  )
}

describe('external provider discovery (R-#246)', () => {
  beforeEach(() => {
    resetExternalProviderForTests()
    delete (window as { ethereum?: unknown }).ethereum
  })

  afterEach(() => {
    resetExternalProviderForTests()
    delete (window as { ethereum?: unknown }).ethereum
  })

  it('resolves window.ethereum when the browser injects it', () => {
    ;(window as { ethereum?: unknown }).ethereum = PROVIDER_A
    expect(getExternalProvider()).toBe(PROVIDER_A)
  })

  // El caso medido: Rabby, MetaMask y OneKey móviles solo anuncian por EIP-6963.
  it('resolves an announced provider when window.ethereum is missing', () => {
    expect(getExternalProvider()).toBeNull()
    announce(PROVIDER_A, 'io.metamask.mobile', 'MetaMask')
    expect(getExternalProvider()).toBe(PROVIDER_A)
    expect(getAnnouncedProviders().map((p) => p.rdns)).toEqual(['io.metamask.mobile'])
  })

  it('keeps the first choice even if another wallet announces later', () => {
    announce(PROVIDER_A, 'io.rabby', 'Rabby Wallet')
    expect(getExternalProvider()).toBe(PROVIDER_A)

    announce(PROVIDER_B, 'com.okex.wallet', 'OKX Wallet')
    // El proveedor elegido no cambia (los clientes viem ya están construidos).
    expect(getExternalProvider()).toBe(PROVIDER_A)
    expect(getAnnouncedProviders()).toHaveLength(2)
  })

  // Sticky: en un navegador de escritorio `window.ethereum` ya existe cuando se
  // resuelve por primera vez, así que gana; si solo llegó el anuncio, ese queda.
  it('prefers window.ethereum when both are present at first resolution', () => {
    ;(window as { ethereum?: unknown }).ethereum = PROVIDER_A
    announce(PROVIDER_B, 'io.rabby', 'Rabby Wallet')
    expect(getExternalProvider()).toBe(PROVIDER_A)
  })

  it('keeps the announced provider if window.ethereum appears later', () => {
    announce(PROVIDER_B, 'io.rabby', 'Rabby Wallet')
    expect(getExternalProvider()).toBe(PROVIDER_B)
    ;(window as { ethereum?: unknown }).ethereum = PROVIDER_A
    expect(getExternalProvider()).toBe(PROVIDER_B)
  })

  it('reports no provider in a plain browser without a wallet', () => {
    expect(getExternalProvider()).toBeNull()
    expect(getAnnouncedProviders()).toEqual([])
  })

  it('does not duplicate an announcement for the same rdns', () => {
    announce(PROVIDER_A, 'io.rabby', 'Rabby Wallet')
    announce(PROVIDER_B, 'io.rabby', 'Rabby Wallet')
    expect(getAnnouncedProviders()).toHaveLength(1)
  })

  // R-#246 §8: de dónde salió la billetera es lo que se registra en `userevent`
  // (`wallet_source`) al iniciar sesión; así se responde la pregunta abierta sobre
  // EIP-6963 con los usuarios reales y sin otro round manual.
  describe('source recorded for userevent', () => {
    it('reports window.ethereum when the browser injects it', () => {
      ;(window as { ethereum?: unknown }).ethereum = PROVIDER_A
      expect(externalWalletSource()).toBe('window.ethereum')
    })

    it('reports the rdns of the announced provider', () => {
      announce(PROVIDER_A, 'io.metamask.mobile', 'MetaMask')
      expect(externalWalletSource()).toBe('eip6963:io.metamask.mobile')
    })

    it('reports unknown when there is no provider', () => {
      expect(externalWalletSource()).toBe('unknown')
    })
  })
})
