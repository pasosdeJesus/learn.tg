// Detección del navegador integrado de una billetera (R-#246 §3, R-#270 §3.1).
// Antes vivía duplicada dentro de `components/ui/qr-code-dialog.tsx`.

import { describe, it, expect, afterEach, vi } from 'vitest'
import { detectWalletBrowser, isWalletBrowser } from '../wallet-browser'

const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const DESKTOP_CHROME = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'

describe('detectWalletBrowser', () => {
  it('detects the wallet browsers by user agent', () => {
    expect(detectWalletBrowser(`${IPHONE_SAFARI} OKX`, undefined, false)).toBe(true)
    expect(detectWalletBrowser(`${IPHONE_SAFARI} OneKey`, undefined, false)).toBe(true)
    expect(detectWalletBrowser(`${IPHONE_SAFARI} MetaMask`, undefined, false)).toBe(true)
    expect(detectWalletBrowser(`${IPHONE_SAFARI} Rabby`, undefined, false)).toBe(true)
    expect(detectWalletBrowser(`${IPHONE_SAFARI} Trust Wallet`, undefined, false)).toBe(true)
    expect(detectWalletBrowser('Mozilla/5.0 (Linux; Android 13; wv) AppleWebKit/537.36', undefined, false)).toBe(true)
  })

  it('detects the wallet flags, and a desktop extension is NOT a wallet browser', () => {
    expect(detectWalletBrowser(IPHONE_SAFARI, { isRabby: true }, false)).toBe(true)
    expect(detectWalletBrowser(IPHONE_SAFARI, { isOkxWallet: true }, false)).toBe(true)
    expect(detectWalletBrowser(IPHONE_SAFARI, { isOneKey: true }, false)).toBe(true)
    // Una extensión normal inyecta `isMetaMask` en un Chrome de escritorio (y Brave y
    // Rabby la ponen por compatibilidad): el UA no trae la marca del navegador propio de
    // la billetera, así que NO se clasifica como tal (R-#270 §11.1).
    expect(detectWalletBrowser(DESKTOP_CHROME, { isMetaMask: true }, false)).toBe(false)
    // Sin marca en el UA y sin banderas: navegador normal.
    expect(detectWalletBrowser(DESKTOP_CHROME, {}, false)).toBe(false)
    expect(detectWalletBrowser(IPHONE_SAFARI, undefined, false)).toBe(false)
  })

  it('never classifies Brave as a wallet browser (its wallet injects isMetaMask)', () => {
    expect(detectWalletBrowser(`${IPHONE_SAFARI} Brave`, { isMetaMask: true }, true)).toBe(false)
  })
})

describe('isWalletBrowser', () => {
  const original = { userAgent: navigator.userAgent }

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', { value: original.userAgent, configurable: true })
    delete (window as { ethereum?: unknown }).ethereum
  })

  it('reads the browser environment', () => {
    Object.defineProperty(navigator, 'userAgent', { value: `${IPHONE_SAFARI} OKX`, configurable: true })
    expect(isWalletBrowser()).toBe(true)

    Object.defineProperty(navigator, 'userAgent', { value: IPHONE_SAFARI, configurable: true })
    expect(isWalletBrowser()).toBe(false)

    Object.defineProperty(navigator, 'userAgent', { value: IPHONE_SAFARI, configurable: true })
    ;(window as { ethereum?: unknown }).ethereum = { isOkxWallet: true }
    expect(isWalletBrowser()).toBe(true)
  })

  it('is safe without a window (SSR)', () => {
    const spy = vi.spyOn(globalThis, 'window', 'get')
    // @ts-expect-error simulating SSR
    spy.mockReturnValue(undefined)
    expect(isWalletBrowser()).toBe(false)
    spy.mockRestore()
  })
})
