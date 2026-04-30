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

export async function checkSelfAppInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    // This is a heuristic approach - not 100% reliable
    const startTime = Date.now()

    // Try to open the app
    window.location.href = 'self://check'

    // If the user returns to the browser quickly, the app is likely not installed
    setTimeout(() => {
      const timeElapsed = Date.now() - startTime
      // If less than 2 seconds elapsed, app is likely not installed
      resolve(timeElapsed > 2000)
    }, 2500)
  })
}

export function getSelfAppStoreUrl(): string {
  if (isIOSDevice()) {
    return 'https://apps.apple.com/us/app/self-zk/id6478563710' // Replace with actual App Store ID
  }

  if (isAndroidDevice()) {
    return 'https://play.google.com/store/apps/details?id=com.proofofpassportapp&pli=1'
  }

  // Default to website or general download page
  return 'https://self.xyz/download'
}
