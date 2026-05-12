/**
 * Deeplink utility for handling Self application deeplinks on mobile devices
 */

import { isIOSDevice, isAndroidDevice } from './mobile-detection'
import { getUniversalLink } from '@selfxyz/core'

export function generateSelfDeeplink(selfApp: any): string {
  return getUniversalLink(selfApp)
}

export function isWalletBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent.toLowerCase()
  // Known web3 wallet browser identifiers
  const walletPatterns = ['okx', 'onekey', 'trust wallet', 'metamask', 'walletconnect', 'rainbow']
  if (walletPatterns.some(p => ua.includes(p))) return true
  // Also detect WebView (used by OneKey, MetaMask, OKX in-app browsers) but exclude Brave
  if (!ua.includes('brave') && ua.includes('; wv')) return true
  return false
}

export async function openSelfApp(selfApp: any): Promise<boolean> {
  try {
    // Web3 wallet browsers (OKX, OneKey, MetaMask, etc.) block deeplinks
    if (isWalletBrowser()) {
      const msg = 'Self app cannot open from within a wallet browser. ' +
        'Please use Safari/Chrome or scan the QR code.'
      console.warn(msg)
      alert(msg)
      return false
    }

    const deeplinkUrl = generateSelfDeeplink(selfApp)

    // For iOS devices, try to open the deeplink directly
    if (isIOSDevice()) {
      window.location.href = deeplinkUrl
      return true
    }

    // For Android devices, try to open the deeplink
    if (isAndroidDevice()) {
      // Try to open the deeplink
      window.location.href = deeplinkUrl

      // Fallback to Play Store if app is not installed (after a delay)
      const fallbackTimer = setTimeout(() => {
        const playStoreUrl =
          'https://play.google.com/store/apps/details?id=com.proofofpassportapp&pli=1'
        window.open(playStoreUrl, '_blank')
      }, 2500)

      // If the app opens, the page loses visibility — cancel the fallback
      const handleVisibility = () => {
        if (document.hidden || (document as any).webkitHidden) {
          clearTimeout(fallbackTimer)
          document.removeEventListener('visibilitychange', handleVisibility)
          document.removeEventListener('webkitvisibilitychange', handleVisibility)
        }
      }
      document.addEventListener('visibilitychange', handleVisibility)
      document.addEventListener('webkitvisibilitychange', handleVisibility)

      return true
    }

    // For other devices, show an error or fallback
    console.warn('Deeplink not supported on this device')
    return false
  } catch (error) {
    console.error('Error opening Self app:', error)
    return false
  }
}
