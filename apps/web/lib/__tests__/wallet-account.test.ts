import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  fetchAccountWallets,
  fetchAccountInvitations,
  inviteWalletAddress,
  cancelInvitationRequest,
  probeInvitation,
  acceptInvitationRequest,
  unlinkAccountWalletRequest,
  linkAccountWallet,
  requestHandover,
  cancelHandoverRequest,
  fetchWalletOverview,
  acceptHandoverRequest,
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

  it('fetches the pending invitations of the account', async () => {
    const invitations = [
      { id: 1, direccion_invitada: '0xccc', usuario_id: 7, expires_at: '2026-11-01T00:00:00Z' },
    ]
    const fetchMock = vi.fn(() => respond(200, { wallets: WALLETS, invitations }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await fetchAccountInvitations('0xAAA')).toEqual(invitations)
    expect(fetchMock).toHaveBeenCalledWith('/api/wallet?walletAddress=0xAAA')
  })

  it('returns null invitations without a session', async () => {
    vi.stubGlobal('fetch', vi.fn(() => respond(401, { error: 'Unauthorized' })))
    expect(await fetchAccountInvitations('0xAAA')).toBeNull()
  })

  it('invites an address to the account', async () => {
    const invitations = [{ id: 2, direccion_invitada: '0xccc', usuario_id: 7 }]
    const fetchMock = vi.fn(() => respond(200, { invited: '0xccc', invitations }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await inviteWalletAddress('0xAAA', '0xCCC')

    expect(result).toEqual({ ok: true, invitations })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/wallet/invite',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ walletAddress: '0xAAA', address: '0xCCC', mode: 'link' }),
      }),
    )
  })

  it('requests a handover with mode=handover', async () => {
    const fetchMock = vi.fn(() => respond(200, { invited: '0xccc', mode: 'handover' }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await requestHandover('0xAAA', '0xCCC')

    expect(result).toEqual({ ok: true, invitations: [] })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/wallet/invite',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ walletAddress: '0xAAA', address: '0xCCC', mode: 'handover' }),
      }),
    )
  })

  it('reads received handover requests and the verified flag', async () => {
    const receivedInvitations = [
      {
        id: 4,
        direccion_invitada: '0xccc',
        duplicate_id: 9,
        duplicate_wallet: '0x999',
      },
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn(() => respond(200, { wallets: WALLETS, invitations: [], receivedInvitations, verified: true })),
    )

    expect(await fetchWalletOverview('0xAAA')).toEqual({
      wallets: WALLETS,
      invitations: [],
      receivedInvitations,
      verified: true,
    })
  })

  it('dismisses a received request by id', async () => {
    const fetchMock = vi.fn(() => respond(200, { cancelled: true, receivedInvitations: [] }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await cancelHandoverRequest('0xAAA', 4)).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/wallet/cancel',
      expect.objectContaining({
        body: JSON.stringify({ walletAddress: '0xAAA', receivedId: 4 }),
      }),
    )
  })

  it('reports a failed handover accept by its server code', async () => {
    vi.stubGlobal('fetch', vi.fn(() => respond(409, { code: 'duplicate-has-value' })))
    expect(await acceptHandoverRequest('m', 's')).toEqual({
      ok: false,
      reason: 'duplicate-has-value',
    })
  })

  it('distinguishes an unverified inviter from a conflict', async () => {
    vi.stubGlobal('fetch', vi.fn(() => respond(403, { error: 'Inviter not verified' })))
    expect(await inviteWalletAddress('0xAAA', '0xCCC')).toEqual({
      ok: false,
      reason: 'unverified',
    })

    vi.stubGlobal('fetch', vi.fn(() => respond(409, { error: 'pending' })))
    expect(await inviteWalletAddress('0xAAA', '0xCCC')).toEqual({
      ok: false,
      reason: 'conflict',
    })
  })

  it('cancels a pending invitation and returns the remaining list', async () => {
    const fetchMock = vi.fn(() => respond(200, { cancelled: true, invitations: [] }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await cancelInvitationRequest('0xAAA', '0xCCC')).toEqual({
      ok: true,
      cancelled: true,
      invitations: [],
    })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/wallet/cancel',
      expect.objectContaining({ body: JSON.stringify({ walletAddress: '0xAAA', address: '0xCCC' }) }),
    )
  })

  it('probes a pending invitation without accepting it', async () => {
    const fetchMock = vi.fn(() => respond(200, { pending: true, invitedBy: 'ana' }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await probeInvitation('m', 's')).toEqual({ ok: true, invitedBy: 'ana', expiresAt: null })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/wallet/accept',
      expect.objectContaining({ body: JSON.stringify({ message: 'm', signature: 's' }) }),
    )
  })

  it('reports no invitation when the wallet is not invited', async () => {
    vi.stubGlobal('fetch', vi.fn(() => respond(404, { code: 'no-invitation' })))
    expect(await probeInvitation('m', 's')).toEqual({ ok: false, reason: 'no-invitation' })
  })

  it('accepts the invitation with explicit consent', async () => {
    const fetchMock = vi.fn(() => respond(200, { accepted: true, invitedBy: 'ana' }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await acceptInvitationRequest('m', 's')).toEqual({ ok: true, invitedBy: 'ana' })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/wallet/accept',
      expect.objectContaining({
        body: JSON.stringify({ message: 'm', signature: 's', confirm: true }),
      }),
    )
  })

  it('reports an invitation that belonged to another account', async () => {
    vi.stubGlobal('fetch', vi.fn(() => respond(409, { code: 'owned-by-other' })))
    expect(await acceptInvitationRequest('m', 's')).toEqual({
      ok: false,
      reason: 'owned-by-other',
    })
  })
})
