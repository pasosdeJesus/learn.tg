import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import {
  isMobileDevice,
  isIOSDevice,
  isAndroidDevice,
  getDeviceInfo,
  useMobileDetection,
} from '@/lib/mobile-detection'

describe('Mobile Detection', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('isMobileDevice', () => {
    it('returns false when window is undefined (SSR)', () => {
      vi.stubGlobal('window', undefined)
      expect(isMobileDevice()).toBe(false)
    })

    it('returns false when navigator is undefined', () => {
      vi.stubGlobal('navigator', undefined)
      expect(isMobileDevice()).toBe(false)
    })

    it('detects iPhone as mobile', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      })
      expect(isMobileDevice()).toBe(true)
    })

    it('detects iPad as mobile', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)',
      })
      expect(isMobileDevice()).toBe(true)
    })

    it('detects Android as mobile', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (Linux; Android 10; SM-G975F)',
      })
      expect(isMobileDevice()).toBe(true)
    })

    it('detects BlackBerry as mobile', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (BlackBerry; U; BlackBerry 9900)',
      })
      expect(isMobileDevice()).toBe(true)
    })

    it('detects Opera Mini as mobile', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Opera/9.80 (J2ME/MIDP; Opera Mini/9.80)',
      })
      expect(isMobileDevice()).toBe(true)
    })

    it('detects desktop Chrome as not mobile', () => {
      vi.stubGlobal('navigator', {
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      })
      expect(isMobileDevice()).toBe(false)
    })

    it('detects desktop Firefox as not mobile', () => {
      vi.stubGlobal('navigator', {
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
      })
      expect(isMobileDevice()).toBe(false)
    })

    it('detects desktop Safari as not mobile', () => {
      vi.stubGlobal('navigator', {
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
      })
      expect(isMobileDevice()).toBe(false)
    })
  })

  describe('isIOSDevice', () => {
    it('returns false when window is undefined', () => {
      vi.stubGlobal('window', undefined)
      expect(isIOSDevice()).toBe(false)
    })

    it('detects iPhone as iOS', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      })
      expect(isIOSDevice()).toBe(true)
    })

    it('detects iPad as iOS', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)',
      })
      expect(isIOSDevice()).toBe(true)
    })

    it('detects iPod as iOS', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (iPod touch; CPU iPhone OS 14_0 like Mac OS X)',
      })
      expect(isIOSDevice()).toBe(true)
    })

    it('does not detect Android as iOS', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (Linux; Android 10; SM-G975F)',
      })
      expect(isIOSDevice()).toBe(false)
    })

    it('does not detect desktop as iOS', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      })
      expect(isIOSDevice()).toBe(false)
    })
  })

  describe('isAndroidDevice', () => {
    it('returns false when window is undefined', () => {
      vi.stubGlobal('window', undefined)
      expect(isAndroidDevice()).toBe(false)
    })

    it('detects Android phone as Android', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (Linux; Android 10; SM-G975F)',
      })
      expect(isAndroidDevice()).toBe(true)
    })

    it('detects Android tablet as Android', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (Linux; Android 9; SM-T820)',
      })
      expect(isAndroidDevice()).toBe(true)
    })

    it('does not detect iPhone as Android', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      })
      expect(isAndroidDevice()).toBe(false)
    })

    it('does not detect desktop as Android', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      })
      expect(isAndroidDevice()).toBe(false)
    })
  })

  describe('getDeviceInfo', () => {
    it('returns correct device info for iPhone', () => {
      const userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)'
      vi.stubGlobal('navigator', { userAgent })

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
      vi.stubGlobal('navigator', { userAgent })

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
      vi.stubGlobal('navigator', { userAgent })

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

  describe('useMobileDetection', () => {
    it('returns true for mobile device after effect', async () => {
      const userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)'
      vi.stubGlobal('navigator', { userAgent })

      const { result } = renderHook(() => useMobileDetection())

      // Wait for useEffect to run
      await act(async () => {
        // This allows useEffect to complete
      })

      expect(result.current).toBe(true)
    })

    it('returns false for desktop device', async () => {
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      vi.stubGlobal('navigator', { userAgent })

      const { result } = renderHook(() => useMobileDetection())

      await act(async () => {})
      expect(result.current).toBe(false)
    })
  })
})
