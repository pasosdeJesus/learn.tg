/**
 * Deeplink utility for handling Self application deeplinks on mobile devices
 */

import { isIOSDevice, isAndroidDevice } from './mobile-detection'

/**
 * Configuration for Self app deeplinks
 */
interface SelfDeeplinkConfig {
  appName: string
  scope: string
  userId: string
  endpoint: string
  devMode?: boolean
  userDefinedData?: string
}

/**
 * Generates a deeplink URL for the Self application
 * @param config Configuration object for the deeplink
 * @returns string URL for the deeplink
 */
export function generateSelfDeeplink(config: SelfDeeplinkConfig): string {
  const {
    appName,
    scope,
    userId,
    endpoint,
    devMode = false,
    userDefinedData = ''
  } = config

  // Base Self app scheme
  const scheme = 'self://'
  
  // Create URL parameters
  const params = new URLSearchParams({
    appName,
    scope,
    userId,
    endpoint,
    devMode: devMode.toString(),
    userDefinedData,
    // Add verification parameters
    version: '2',
    userIdType: 'hex',
    endpointType: devMode ? 'staging_https' : 'https',
    // Disclosures
    'disclosures.name': 'true',
    'disclosures.nationality': 'true',
    'disclosures.ofac': 'true',
  })

  return `${scheme}verify?${params.toString()}`
}

/**
 * Opens the Self application using a deeplink
 * @param config Configuration object for the deeplink
 * @returns Promise<boolean> indicating if the deeplink was attempted
 */
export async function openSelfApp(config: SelfDeeplinkConfig): Promise<boolean> {
  try {
    const deeplinkUrl = generateSelfDeeplink(config)
    
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
        const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.selfxyz.self'
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

/**
 * Checks if the Self app is likely installed by attempting to open it
 * @returns Promise<boolean> indicating if the app appears to be installed
 */
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

/**
 * Gets the appropriate app store URL for the current platform
 * @returns string URL to the app store
 */
export function getSelfAppStoreUrl(): string {
  if (isIOSDevice()) {
    return 'https://apps.apple.com/app/self-identity-verification/id1234567890' // Replace with actual App Store ID
  }
  
  if (isAndroidDevice()) {
    return 'https://play.google.com/store/apps/details?id=com.selfxyz.self'
  }
  
  // Default to website or general download page
  return 'https://self.xyz/download'
}

/**
 * Creates a Self deeplink configuration from SelfApp instance
 * @param selfApp The SelfApp instance
 * @returns SelfDeeplinkConfig object
 */
export function createDeeplinkConfigFromSelfApp(selfApp: any): SelfDeeplinkConfig {
  // Extract configuration from the SelfApp instance
  // This assumes the SelfApp has these properties - adjust based on actual API
  return {
    appName: selfApp.appName || 'Learn Through Games',
    scope: selfApp.scope || 'learn.tg',
    userId: selfApp.userId || '',
    endpoint: selfApp.endpoint || '',
    devMode: selfApp.devMode || false,
    userDefinedData: selfApp.userDefinedData || '',
  }
}