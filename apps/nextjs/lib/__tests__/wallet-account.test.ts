import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  fetchAccountWallets,
  unlinkAccountWalletRequest,
  linkAccountWallet,
} from '@/lib/wallet-account'

const WALLETS = [
  { id: 1, usuario_id: 7, billetera: '0xaaa', linked_at: '2026-01-01T00:00:00Z' },
  { id: 2, usuario_id: 7, billetera: '0xbbb', linked_at: '2026-02-01T00:00:00Z' },
]

function respond(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response)
}

describe('wallet-account (R-#265 / m#50)', () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it('fetches the account wallets with the session hint', async () => {
    const fetchMock = vi.fn(() => respond(200, { wallets: WALLETS }))
    vi.stubGlobal('fetch', fetchMock)

    const wallets = await fetchAccountWallets('0xAAA')

    expect(wallets).toEqual(WALLETS)
    expect(fetchMock).toHaveBeenCalledWith('/api/wallet?walletAddress=0xAAA')
  })

  it('returns null when there is no session', async () => {
    vi.stubGlobal('fetch', vi.fn(() => respond(401, { error: 'Unauthorized' })))
    expect(await fetchAccountWallets('0xAAA')).toBeNull()
  })

  it('returns null when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))
    expect(await fetchAccountWallets('0xAAA')).toBeNull()
  })

  it('unlinks a secondary wallet and returns the updated list', async () => {
    const fetchMock = vi.fn(() => respond(200, { wallets: [WALLETS[0]], unlinked: '0xbbb' }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await unlinkAccountWalletRequest('0xAAA', '0xBBB')

    expect(result).toEqual({ ok: true, wallets: [WALLETS[0]] })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/wallet/unlink',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ walletAddress: '0xAAA', address: '0xBBB' }),
      }),
    )
  })

  it('reports the last wallet as not unlinkable', async () => {
    vi.stubGlobal('fetch', vi.fn(() => respond(409, { error: 'last' })))
    expect(await unlinkAccountWalletRequest('0xAAA', '0xBBB')).toEqual({
      ok: false,
      reason: 'last-wallet',
    })
  })

  it('links a wallet already signed with SIWE', async () => {
    const fetchMock = vi.fn(() => respond(200, { wallets: WALLETS, linked: '0xbbb' }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await linkAccountWallet({ walletAddress: '0xAAA', message: 'm', signature: 's' })

    expect(result).toEqual({ ok: true, wallets: WALLETS })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/wallet/link',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ walletAddress: '0xAAA', message: 'm', signature: 's' }),
      }),
    )
  })

  it('reports a wallet already owned by another account', async () => {
    vi.stubGlobal('fetch', vi.fn(() => respond(409, { error: 'owned' })))
    expect(await linkAccountWallet({ walletAddress: '0xAAA', message: 'm', signature: 's' })).toEqual({
      ok: false,
      reason: 'owned-by-other',
    })
  })
})
