// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

// Hoisted mocks (disponibles antes de vi.mock)
const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  removeItem: vi.fn(),
  listeners: {} as Record<string, ((...a: any[]) => void)[]>,
  accountsResult: [] as string[] | Promise<string[]>,
  emit: (evt: string, ...args: any[]) => {
    const hs = mocks.listeners[evt] || []
    hs.forEach((h) => h(...args))
  },
}))

vi.mock('next-auth/react', () => ({
  signOut: mocks.signOut,
  useSession: () => ({ data: { address: '0xabcd' }, status: 'authenticated' }),
}))

// window.ethereum con captura de handlers y eth_accounts controlable
const ethereum: any = {
  request: vi.fn(async ({ method }: { method: string }) => {
    if (method === 'eth_accounts') return mocks.accountsResult
    return null
  }),
  on: vi.fn((evt: string, h: (...a: any[]) => void) => {
    ;(mocks.listeners[evt] = mocks.listeners[evt] || []).push(h)
  }),
  removeListener: vi.fn((evt: string, h: (...a: any[]) => void) => {
    mocks.listeners[evt] = (mocks.listeners[evt] || []).filter((x) => x !== h)
  }),
}

Object.defineProperty(window, 'ethereum', { value: ethereum, configurable: true, writable: true })

import { WalletEventListener } from '@/components/WalletEventListener'

describe('WalletEventListener (R-#227 problema 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listeners = {}
    mocks.accountsResult = []
    localStorage.clear()
    vi.useRealTimers()
  })

  it('NÃO firma desconexión si accountsChanged([]) es transitorio (cuenta sigue conectada)', async () => {
    mocks.accountsResult = ['0xabcd'] // eth_accounts devuelve la cuenta tras el evento
    render(<WalletEventListener />)
    await new Promise((r) => setTimeout(r, 50))

    mocks.emit('accountsChanged', [])
    await new Promise((r) => setTimeout(r, 700)) // debounce 400ms + recheck

    expect(mocks.signOut).not.toHaveBeenCalled()
  })

  it('sí firma desconexión si accountsChanged([]) es real (eth_accounts vacío)', async () => {
    mocks.accountsResult = [] // desconexión real
    render(<WalletEventListener />)
    await new Promise((r) => setTimeout(r, 50))

    mocks.emit('accountsChanged', [])
    await new Promise((r) => setTimeout(r, 700))

    expect(mocks.signOut).toHaveBeenCalledWith({ redirect: true, callbackUrl: '/' })
  })

  it('NÃO firma desconexión si disconnect es transitorio (cuenta sigue conectada)', async () => {
    mocks.accountsResult = ['0xabcd']
    render(<WalletEventListener />)
    await new Promise((r) => setTimeout(r, 50))

    mocks.emit('disconnect')
    await new Promise((r) => setTimeout(r, 700))

    expect(mocks.signOut).not.toHaveBeenCalled()
  })

  it('sí firma desconexión si disconnect es real (eth_accounts vacío)', async () => {
    mocks.accountsResult = []
    render(<WalletEventListener />)
    await new Promise((r) => setTimeout(r, 50))

    mocks.emit('disconnect')
    await new Promise((r) => setTimeout(r, 700))

    expect(mocks.signOut).toHaveBeenCalledWith({ redirect: true, callbackUrl: '/' })
  })

  it('no recarga/limpia si la cuenta conectada NO cambió (accountsChanged con misma cuenta)', async () => {
    mocks.accountsResult = ['0xabcd']
    render(<WalletEventListener />)
    await new Promise((r) => setTimeout(r, 50))

    mocks.emit('accountsChanged', ['0xabcd']) // no vacío → nunca fue desconexión
    await new Promise((r) => setTimeout(r, 700))

    expect(mocks.signOut).not.toHaveBeenCalled()
  })
})
