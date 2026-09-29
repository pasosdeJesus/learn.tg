/**
 * Detección del navegador integrado de una billetera (R-#246 §3, R-#270 §3.1).
 *
 * En el navegador propio de Rabby/MetaMask/OKX/OneKey manda esa billetera y la de la
 * aplicación se ofrece como alternativa; en un navegador normal (aunque tenga una
 * extensión inyectada) la billetera de la aplicación es la opción por defecto.
 *
 * Brave se revisa primero: su billetera inyecta `isMetaMask = true` por compatibilidad.
 * MiniPay queda fuera de alcance (no buscamos aparecer en su catálogo).
 */
export function detectWalletBrowser(ua: string, ethereum: unknown, isBrave: boolean): boolean {
  if (isBrave) return false
  const lc = (ua || '').toLowerCase()
  const eth = ethereum as Record<string, unknown> | undefined
  return (
    ['okx', 'onekey', 'metamask', 'trust wallet'].some((p) => lc.includes(p)) ||
    eth?.isOneKey === true ||
    eth?.isOkxWallet === true ||
    eth?.isMetaMask === true ||
    lc.includes('; wv')
  )
}

/** Igual que `detectWalletBrowser` leyendo el entorno del navegador. */
export function isWalletBrowser(): boolean {
  if (typeof window === 'undefined') return false
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const isBrave =
    ua.toLowerCase().includes('brave') || typeof (navigator as { brave?: unknown }).brave !== 'undefined'
  return detectWalletBrowser(ua, (window as { ethereum?: unknown }).ethereum, isBrave)
}
