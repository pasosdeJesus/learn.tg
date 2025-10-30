import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { 
  isMobileDevice, 
  isIOSDevice, 
  isAndroidDevice, 
  getDeviceInfo 
} from '@/lib/mobile-detection'

// Mock navigator
const mockNavigator = (userAgent: string) => {
  Object.defineProperty(window, 'navigator', {
    value: {
      userAgent,
    },
    writable: true,
  })
}

describe('Mobile Detection', () => {
  beforeEach(() => {
    // Reset window and navigator
    vi.stubGlobal('window', {})
    vi.stubGlobal('navigator', {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('isMobileDevice', () => {
    it('returns false when window is undefined (SSR)', () => {
      vi.stubGlobal('window', undefined)
      expect(isMobileDevice()).toBe(false)
    })

    it('returns false when navigator is undefined', () => {
      vi.stubGlobal('window', {})
      vi.stubGlobal('navigator', undefined)
      expect(isMobileDevice()).toBe(false)
    })

    it('detects iPhone as mobile', () => {
      mockNavigator('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)')
      expect(isMobileDevice()).toBe(true)
    })

    it('detects iPad as mobile', () => {
      mockNavigator('Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)')
      expect(isMobileDevice()).toBe(true)
    })

    it('detects Android as mobile', () => {
      mockNavigator('Mozilla/5.0 (Linux; Android 10; SM-G975F)')
      expect(isMobileDevice()).toBe(true)
    })

    it('detects BlackBerry as mobile', () => {
      mockNavigator('Mozilla/5.0 (BlackBerry; U; BlackBerry 9900)')
      expect(isMobileDevice()).toBe(true)
    })

    it('detects Opera Mini as mobile', () => {
      mockNavigator('Opera/9.80 (J2ME/MIDP; Opera Mini/9.80)')
      expect(isMobileDevice()).toBe(true)
    })

    it('detects desktop Chrome as not mobile', () => {
      mockNavigator('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36')
      expect(isMobileDevice()).toBe(false)
    })

    it('detects desktop Firefox as not mobile', () => {
      mockNavigator('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0')
      expect(isMobileDevice()).toBe(false)
    })

    it('detects desktop Safari as not mobile', () => {
      mockNavigator('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15')
      expect(isMobileDevice()).toBe(false)
    })
  })

  describe('isIOSDevice', () => {
    it('returns false when window is undefined', () => {
      vi.stubGlobal('window', undefined)
      expect(isIOSDevice()).toBe(false)
    })

    it('detects iPhone as iOS', () => {
      mockNavigator('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)')
      expect(isIOSDevice()).toBe(true)
    })

    it('detects iPad as iOS', () => {
      mockNavigator('Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)')
      expect(isIOSDevice()).toBe(true)
    })

    it('detects iPod as iOS', () => {
      mockNavigator('Mozilla/5.0 (iPod touch; CPU iPhone OS 14_0 like Mac OS X)')
      expect(isIOSDevice()).toBe(true)
    })

    it('does not detect Android as iOS', () => {
      mockNavigator('Mozilla/5.0 (Linux; Android 10; SM-G975F)')
      expect(isIOSDevice()).toBe(false)
    })

    it('does not detect desktop as iOS', () => {
      mockNavigator('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')
      expect(isIOSDevice()).toBe(false)
    })
  })

  describe('isAndroidDevice', () => {
    it('returns false when window is undefined', () => {
      vi.stubGlobal('window', undefined)
      expect(isAndroidDevice()).toBe(false)
    })

    it('detects Android phone as Android', () => {
      mockNavigator('Mozilla/5.0 (Linux; Android 10; SM-G975F)')
      expect(isAndroidDevice()).toBe(true)
    })

    it('detects Android tablet as Android', () => {
      mockNavigator('Mozilla/5.0 (Linux; Android 9; SM-T820)')
      expect(isAndroidDevice()).toBe(true)
    })

    it('does not detect iPhone as Android', () => {
      mockNavigator('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)')
      expect(isAndroidDevice()).toBe(false)
    })

    it('does not detect desktop as Android', () => {
      mockNavigator('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
      expect(isAndroidDevice()).toBe(false)
    })
  })

  describe('getDeviceInfo', () => {
    it('returns correct device info for iPhone', () => {
      const userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)'
      mockNavigator(userAgent)
      
      const info = getDeviceInfo()
      expect(info).toEqual({
        isMobile: true,
        isIOS: true,
        isAndroid: false,
        userAgent,
      })
    })

    it('returns correct device info for Android', () => {
      const userAgent = 'Mozilla/5.0 (Linux; Android 10; SM-G975F)'
      mockNavigator(userAgent)
      
      const info = getDeviceInfo()
      expect(info).toEqual({
        isMobile: true,
        isIOS: false,
        isAndroid: true,
        userAgent,
      })
    })

    it('returns correct device info for desktop', () => {
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      mockNavigator(userAgent)
      
      const info = getDeviceInfo()
      expect(info).toEqual({
        isMobile: false,
        isIOS: false,
        isAndroid: false,
        userAgent,
      })
    })

    it('handles undefined navigator gracefully', () => {
      vi.stubGlobal('navigator', undefined)
      
      const info = getDeviceInfo()
      expect(info).toEqual({
        isMobile: false,
        isIOS: false,
        isAndroid: false,
        userAgent: '',
      })
    })
  })
})