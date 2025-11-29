/**
 * Mobile detection utility for determining if the user is on a mobile device
 */

/**
 * Detects if the current device is a mobile device based on user agent
 * @returns boolean indicating if the device is mobile
 */
export function isMobileDevice(): boolean {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false
  }

  const userAgent = navigator.userAgent.toLowerCase()

  // Check for mobile device indicators in user agent
  const mobileRegex =
    /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i

  return mobileRegex.test(userAgent)
}

/**
 * Detects if the current device is specifically an iOS device
 * @returns boolean indicating if the device is iOS
 */
export function isIOSDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false
  }

  const userAgent = navigator.userAgent.toLowerCase()

  return /iphone|ipad|ipod/i.test(userAgent)
}

/**
 * Detects if the current device is specifically an Android device
 * @returns boolean indicating if the device is Android
 */
export function isAndroidDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false
  }

  const userAgent = navigator.userAgent.toLowerCase()

  return /android/i.test(userAgent)
}

/**
 * Gets detailed device information
 * @returns object with device type information
 */
export function getDeviceInfo() {
  return {
    isMobile: isMobileDevice(),
    isIOS: isIOSDevice(),
    isAndroid: isAndroidDevice(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  }
}

/**
 * Hook for React components to detect mobile devices with SSR safety
 * @returns boolean indicating if the device is mobile (false during SSR)
 */
export function useMobileDetection() {
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    setIsMobile(isMobileDevice())
  }, [])

  return isMobile
}

// For React import
import * as React from 'react'
