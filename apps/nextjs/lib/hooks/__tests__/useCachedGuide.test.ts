import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCachedGuide } from '../useCachedGuide'

function setOnLine(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true })
}

describe('useCachedGuide (R-#241)', () => {
  beforeEach(() => setOnLine(true))
  afterEach(() => setOnLine(true))

  it('reports the offline state of the browser', () => {
    setOnLine(false)
    const { result } = renderHook(() => useCachedGuide('en/gdcluster/guide1'))
    expect(result.current.isOffline).toBe(true)
    expect(result.current.isFromCache).toBe(false)
  })

  it('exposes the cached copy flag for the page to show a hint', () => {
    const { result } = renderHook(() => useCachedGuide('en/gdcluster/guide1'))
    act(() => result.current.markFromCache(true))
    expect(result.current.isFromCache).toBe(true)
  })

  it('keeps a visited guide readable offline (save then read back)', async () => {
    const key = 'en/gdcluster/guide-bajo-prueba'
    const { result } = renderHook(() => useCachedGuide(key))

    await act(async () => { await result.current.save('Contenido de la guía') })

    setOnLine(false)
    let cached: string | null = null
    await act(async () => { cached = await result.current.getCached() })
    expect(cached).toBe('Contenido de la guía')
  })

  it('returns null when the guide was never cached', async () => {
    const { result } = renderHook(() => useCachedGuide('en/gdcluster/guide-nunca-vista'))
    let cached: string | null = 'inicial'
    await act(async () => { cached = await result.current.getCached() })
    expect(cached).toBeNull()
  })

  it('ignores an empty markdown', async () => {
    const key = 'en/gdcluster/guide-vacia'
    const { result } = renderHook(() => useCachedGuide(key))
    await act(async () => { await result.current.save('') })
    let cached: string | null = 'inicial'
    await act(async () => { cached = await result.current.getCached() })
    expect(cached).toBeNull()
  })

  it('removes the cached copy', async () => {
    const key = 'en/gdcluster/guide-removida'
    const { result } = renderHook(() => useCachedGuide(key))
    await act(async () => { await result.current.save('algo') })
    await act(async () => { await result.current.remove() })
    let cached: string | null = 'inicial'
    await act(async () => { cached = await result.current.getCached() })
    expect(cached).toBeNull()
  })
})
