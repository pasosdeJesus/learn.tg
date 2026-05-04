import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateSelfDeeplink, openSelfApp, checkSelfAppInstalled, getSelfAppStoreUrl } from '../deeplink'
import { isIOSDevice, isAndroidDevice } from '../mobile-detection'

vi.mock('../mobile-detection', () => ({
  isIOSDevice: vi.fn(),
  isAndroidDevice: vi.fn(),
}))

vi.mock('@selfxyz/core', () => ({
  getUniversalLink: vi.fn(() => 'https://self.xyz/deeplink/test'),
}))

describe('deeplink', () => {
  let mockWindowHref: string
  let mockWindowOpen: any
  let mockConsoleWarn: any
  let mockConsoleError: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockWindowHref = ''
    mockWindowOpen = vi.fn()
    mockConsoleWarn = vi.fn()
    mockConsoleError = vi.fn()

    Object.defineProperty(global, 'window', {
      value: {
        get location() {
          return {
            get href() { return mockWindowHref },
            set href(value: string) { mockWindowHref = value }
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
      value: { warn: mockConsoleWarn, error: mockConsoleError, log: vi.fn() },
      writable: true,
    })
  })

  afterEach(() => { vi.restoreAllMocks() })

  describe('generateSelfDeeplink', () => {
    it.skip('should call getUniversalLink with provided config', () => {
      const { getUniversalLink } = require('@selfxyz/core')
      const result = generateSelfDeeplink({ app: 'test' })
      expect(getUniversalLink).toHaveBeenCalledWith({ app: 'test' })
      expect(result).toBe('https://self.xyz/deeplink/test')
    })
  })

  describe('openSelfApp', () => {
    it('should return true and set location.href for iOS', async () => {
      vi.mocked(isIOSDevice).mockReturnValue(true)
      vi.mocked(isAndroidDevice).mockReturnValue(false)
      const result = await openSelfApp({ app: 'test' })
      expect(mockWindowHref).toBe('https://self.xyz/deeplink/test')
      expect(result).toBe(true)
    })

    it('should return true and open Play Store fallback for Android', async () => {
      vi.mocked(isIOSDevice).mockReturnValue(false)
      vi.mocked(isAndroidDevice).mockReturnValue(true)
      vi.useFakeTimers()
      const resultPromise = openSelfApp({ app: 'test' })
      expect(mockWindowHref).toBe('https://self.xyz/deeplink/test')
      vi.advanceTimersByTime(2500)
      const result = await resultPromise
      expect(mockWindowOpen).toHaveBeenCalled()
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

    it('should return false and log on exception', async () => {
      vi.mocked(isIOSDevice).mockImplementation(() => { throw new Error('Test error') })
      const result = await openSelfApp({ app: 'test' })
      expect(mockConsoleError).toHaveBeenCalledWith('Error opening Self app:', expect.any(Error))
      expect(result).toBe(false)
    })
  })

  describe('checkSelfAppInstalled', () => {
    it.skip('should resolve false when user returns quickly (app not installed)', async () => {
      vi.useFakeTimers()
      const promise = checkSelfAppInstalled()
      vi.advanceTimersByTime(100)
      const result = await promise
      expect(result).toBe(false)
      vi.useRealTimers()
    })

    it('should resolve true when user does not return quickly (app installed)', async () => {
      vi.useFakeTimers()
      const promise = checkSelfAppInstalled()
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
