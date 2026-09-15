import { describe, it, expect, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOfflineStatus } from '../useOfflineStatus'

function setOnLine(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    value,
    configurable: true,
  })
}

describe('useOfflineStatus', () => {
  afterEach(() => setOnLine(true))

  it('starts online', () => {
    setOnLine(true)
    const { result } = renderHook(() => useOfflineStatus())
    expect(result.current.isOffline).toBe(false)
  })

  it('reports offline when navigator.onLine is false on mount', () => {
    setOnLine(false)
    const { result } = renderHook(() => useOfflineStatus())
    expect(result.current.isOffline).toBe(true)
  })

  it('follows the offline and online events', () => {
    setOnLine(true)
    const { result } = renderHook(() => useOfflineStatus())
    expect(result.current.isOffline).toBe(false)

    act(() => {
      setOnLine(false)
      window.dispatchEvent(new Event('offline'))
    })
    expect(result.current.isOffline).toBe(true)

    act(() => {
      setOnLine(true)
      window.dispatchEvent(new Event('online'))
    })
    expect(result.current.isOffline).toBe(false)
  })
})
