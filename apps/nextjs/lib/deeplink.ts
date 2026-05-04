/**
 * Deeplink utility for handling Self application deeplinks on mobile devices
 */

import { isIOSDevice, isAndroidDevice } from './mobile-detection'
import { getUniversalLink } from '@selfxyz/core'

export function generateSelfDeeplink(selfApp: any): string {
  return getUniversalLink(selfApp)
}

export async function openSelfApp(selfApp: any): Promise<boolean> {
  try {
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
      setTimeout(() => {
        // This will only execute if the user is still on the page (app didn't open)
        const playStoreUrl =
          'https://play.google.com/store/apps/details?id=com.proofofpassportapp&pli=1'
        window.open(playStoreUrl, '_blank')
      }, 2500)

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
