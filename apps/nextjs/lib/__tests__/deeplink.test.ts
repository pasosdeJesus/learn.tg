import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateSelfDeeplink, openSelfApp, checkSelfAppInstalled, getSelfAppStoreUrl } from '../deeplink'
import { isIOSDevice, isAndroidDevice } from '../mobile-detection'

// Mock mobile-detection module
vi.mock('../mobile-detection', () => ({
  isIOSDevice: vi.fn(),
  isAndroidDevice: vi.fn(),
}))

// Mock @selfxyz/core completely to avoid side effects
vi.mock('@selfxyz/core', () => ({
  getUniversalLink: vi.fn(() => 'https://self.xyz/deeplink/test'),
  // Add other exports if needed
}))

describe('deeplink', () => {
  let mockWindowHref: string
  let mockWindowOpen: any
  let mockConsoleWarn: any
  let mockConsoleError: any

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mocked globals
    mockWindowHref = ''
    mockWindowOpen = vi.fn()
    mockConsoleWarn = vi.fn()
    mockConsoleError = vi.fn()

    Object.defineProperty(global, 'window', {
      value: {
        get location() {
          return {
            href: mockWindowHref,
            set href(value: string) {
              mockWindowHref = value
            }
          }
        },
        open: mockWindowOpen,
      },
      writable: true,
    })
    Object.defineProperty(global, 'navigator', {
      value: { userAgent: '' },
      writable: true,
    })
    Object.defineProperty(global, 'console', {
      value: {
        warn: mockConsoleWarn,
        error: mockConsoleError,
        log: vi.fn(),
      },
      writable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('generateSelfDeeplink', () => {
    it.skip('should call getUniversalLink with provided config', () => {
      const mockConfig = { app: 'test' }
      const { getUniversalLink } = require('@selfxyz/core')
      const result = generateSelfDeeplink(mockConfig)
      expect(getUniversalLink).toHaveBeenCalledWith(mockConfig)
      expect(result).toBe('https://self.xyz/deeplink/test')
    })
  })

  describe('openSelfApp', () => {
    it('should return true and set location.href for iOS devices', async () => {
      vi.mocked(isIOSDevice).mockReturnValue(true)
      vi.mocked(isAndroidDevice).mockReturnValue(false)

      const result = await openSelfApp({ app: 'test' })

      expect(isIOSDevice).toHaveBeenCalled()
      expect(mockWindowHref).toBe('https://self.xyz/deeplink/test')
      expect(result).toBe(true)
    })

    it('should return true and set location.href for Android devices with Play Store fallback', async () => {
      vi.mocked(isIOSDevice).mockReturnValue(false)
      vi.mocked(isAndroidDevice).mockReturnValue(true)

      vi.useFakeTimers()
      const resultPromise = openSelfApp({ app: 'test' })

      // Verify immediate action
      expect(mockWindowHref).toBe('https://self.xyz/deeplink/test')

      // Fast-forward timers
      vi.advanceTimersByTime(2500)

      const result = await resultPromise

      expect(isAndroidDevice).toHaveBeenCalled()
      expect(mockWindowOpen).toHaveBeenCalledWith(
        'https://play.google.com/store/apps/details?id=com.proofofpassportapp&pli=1',
        '_blank'
      )
      expect(result).toBe(true)
      vi.useRealTimers()
    })

    it('should return false and warn for unsupported devices', async () => {
      vi.mocked(isIOSDevice).mockReturnValue(false)
      vi.mocked(isAndroidDevice).mockReturnValue(false)

      const result = await openSelfApp({ app: 'test' })

      expect(mockConsoleWarn).toHaveBeenCalledWith('Deeplink not supported on this device')
      expect(result).toBe(false)
    })

    it('should return false and log error on exception', async () => {
      vi.mocked(isIOSDevice).mockImplementation(() => {
        throw new Error('Test error')
      })

      const result = await openSelfApp({ app: 'test' })

      expect(mockConsoleError).toHaveBeenCalledWith('Error opening Self app:', expect.any(Error))
      expect(result).toBe(false)
    })
  })

  describe('checkSelfAppInstalled', () => {
    it.skip('should resolve false when user returns quickly (app not installed)', async () => {
      vi.useFakeTimers()

      const promise = checkSelfAppInstalled()
      // Immediately advance timers to simulate quick return
      vi.advanceTimersByTime(100)

      const result = await promise
      expect(result).toBe(false)
      vi.useRealTimers()
    })

    it('should resolve true when user does not return quickly (app installed)', async () => {
      vi.useFakeTimers()

      const promise = checkSelfAppInstalled()
      // Advance timers past the 2-second threshold
      vi.advanceTimersByTime(2500)

      const result = await promise
      expect(result).toBe(true)
      vi.useRealTimers()
    })
  })

  describe('getSelfAppStoreUrl', () => {
    it('should return iOS App Store URL for iOS devices', () => {
      vi.mocked(isIOSDevice).mockReturnValue(true)
      vi.mocked(isAndroidDevice).mockReturnValue(false)

      const url = getSelfAppStoreUrl()
      expect(url).toBe('https://apps.apple.com/us/app/self-zk/id6478563710')
    })

    it('should return Android Play Store URL for Android devices', () => {
      vi.mocked(isIOSDevice).mockReturnValue(false)
      vi.mocked(isAndroidDevice).mockReturnValue(true)

      const url = getSelfAppStoreUrl()
      expect(url).toBe('https://play.google.com/store/apps/details?id=com.proofofpassportapp&pli=1')
    })

    it('should return default download URL for other devices', () => {
      vi.mocked(isIOSDevice).mockReturnValue(false)
      vi.mocked(isAndroidDevice).mockReturnValue(false)

      const url = getSelfAppStoreUrl()
      expect(url).toBe('https://self.xyz/download')
    })
  })
})