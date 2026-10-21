// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import { ServiceWorkerRegistrar } from '../ServiceWorkerRegistrar'
import { CHUNK_RELOAD_KEY } from '@/lib/sw-recovery'

describe('ServiceWorkerRegistrar (R-#240)', () => {
  const register = vi.fn(() => Promise.resolve({} as ServiceWorkerRegistration))
  const unregister = vi.fn(() => Promise.resolve(true))
  const cachesDelete = vi.fn(() => Promise.resolve(true))
  const reload = vi.fn()
  const swListeners: Record<string, (() => void) | undefined> = {}
  let controller: object | null = {}

  beforeEach(() => {
    register.mockClear()
    unregister.mockClear()
    cachesDelete.mockClear()
    reload.mockClear()
    Object.keys(swListeners).forEach((k) => delete swListeners[k])
    controller = {}
    Object.defineProperty(window.navigator, 'serviceWorker', {
      value: {
        register,
        getRegistrations: vi.fn(() => Promise.resolve([{ unregister }])),
        get controller() { return controller },
        addEventListener: vi.fn((type: string, fn: () => void) => { swListeners[type] = fn }),
        removeEventListener: vi.fn(),
      },
      configurable: true,
    })
    vi.stubGlobal('caches', { keys: vi.fn(() => Promise.resolve(['learntg-pages'])), delete: cachesDelete })
    Object.defineProperty(window, 'location', {
      value: { href: 'http://localhost/en', reload },
      writable: true,
      configurable: true,
    })
    window.sessionStorage.clear()
    vi.stubEnv('NEXT_PUBLIC_PWA_ENABLED', '1')
    vi.stubEnv('NEXT_PUBLIC_PWA_DISABLE', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('registers the service worker when the build generated one', () => {
    render(<ServiceWorkerRegistrar />)
    expect(register).toHaveBeenCalledWith('/sw.js')
    expect(unregister).not.toHaveBeenCalled()
  })

  it('registers when the build did not set the flag (default is enabled)', () => {
    vi.unstubAllEnvs()
    render(<ServiceWorkerRegistrar />)
    expect(register).toHaveBeenCalledWith('/sw.js')
  })

  it('does not register when the build disabled the PWA', async () => {
    vi.stubEnv('NEXT_PUBLIC_PWA_ENABLED', '0')
    render(<ServiceWorkerRegistrar />)
    await Promise.resolve()
    expect(register).not.toHaveBeenCalled()
  })

  it('unregisters a leftover worker and clears its caches when the PWA is off', async () => {
    vi.stubEnv('NEXT_PUBLIC_PWA_ENABLED', '0')
    render(<ServiceWorkerRegistrar />)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(unregister).toHaveBeenCalled()
    expect(cachesDelete).toHaveBeenCalledWith('learntg-pages')
  })

  it('NEXT_PUBLIC_PWA_DISABLE=1 forces the cleanup even when the flag says enabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_PWA_ENABLED', '1')
    vi.stubEnv('NEXT_PUBLIC_PWA_DISABLE', '1')
    render(<ServiceWorkerRegistrar />)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(register).not.toHaveBeenCalled()
    expect(unregister).toHaveBeenCalled()
  })

  it('does not blow up when the browser has no service worker support', () => {
    Object.defineProperty(window.navigator, 'serviceWorker', {
      value: undefined,
      configurable: true,
    })
    expect(() => render(<ServiceWorkerRegistrar />)).not.toThrow()
    expect(register).not.toHaveBeenCalled()
  })

  it('survives a rejected registration', async () => {
    register.mockReturnValueOnce(Promise.reject(new Error('offline')))
    expect(() => render(<ServiceWorkerRegistrar />)).not.toThrow()
    await Promise.resolve()
  })

  it('reloads once when the controller changes and a controller already existed', () => {
    render(<ServiceWorkerRegistrar />)
    act(() => { swListeners['controllerchange']?.() })
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does not reload on the first install (no previous controller)', () => {
    controller = null
    render(<ServiceWorkerRegistrar />)
    act(() => { swListeners['controllerchange']?.() })
    expect(reload).not.toHaveBeenCalled()
  })

  it('reloads once on a ChunkLoadError and does not loop', () => {
    render(<ServiceWorkerRegistrar />)
    act(() => {
      window.dispatchEvent(new ErrorEvent('error', { error: new Error('ChunkLoadError: Loading chunk 911 failed.') }))
    })
    expect(reload).toHaveBeenCalledTimes(1)
    expect(window.sessionStorage.getItem(CHUNK_RELOAD_KEY)).not.toBeNull()

    act(() => {
      window.dispatchEvent(new ErrorEvent('error', { error: new Error('ChunkLoadError: Loading chunk 911 failed.') }))
    })
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('ignores unrelated errors', () => {
    render(<ServiceWorkerRegistrar />)
    act(() => {
      window.dispatchEvent(new ErrorEvent('error', { error: new Error('TypeError: boom') }))
    })
    expect(reload).not.toHaveBeenCalled()
  })

  it('removes its listeners on unmount', () => {
    const removeSpy = vi.fn()
    Object.defineProperty(window.navigator, 'serviceWorker', {
      value: {
        register,
        getRegistrations: vi.fn(() => Promise.resolve([])),
        controller: {},
        addEventListener: vi.fn(),
        removeEventListener: removeSpy,
      },
      configurable: true,
    })
    const { unmount } = render(<ServiceWorkerRegistrar />)
    unmount()
    expect(removeSpy).toHaveBeenCalledWith('controllerchange', expect.any(Function))
  })
})
