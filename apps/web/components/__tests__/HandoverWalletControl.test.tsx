// @vitest-environment jsdom
import * as React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const A = '0x' + 'a'.repeat(40)
const OLD = '0x' + 'b'.repeat(40)

const mocks = vi.hoisted(() => ({
  sessionAddress: ('0x' + 'a'.repeat(40)) as string | undefined,
  inAppAddress: undefined as string | undefined,
  isInAppUnlocked: false,
  provider: { request: vi.fn() },
  fetchWalletOverview: vi.fn(),
  requestHandover: vi.fn(),
  acceptHandoverRequest: vi.fn(),
  cancelHandoverRequest: vi.fn(),
  signSiweForAddress: vi.fn(),
}))

vi.mock('@/lib/hooks/useAuthAddress', () => ({
  useAuthAddress: () => ({
    address: mocks.sessionAddress,
    sessionAddress: mocks.sessionAddress,
    inAppAddress: mocks.inAppAddress,
    isInAppUnlocked: mocks.isInAppUnlocked,
  }),
}))

vi.mock('@/lib/hooks/useWalletProvider', () => ({
  useWalletProvider: () => ({ provider: mocks.provider }),
}))

vi.mock('@/lib/wallet-account', () => ({
  fetchWalletOverview: mocks.fetchWalletOverview,
  requestHandover: mocks.requestHandover,
  acceptHandoverRequest: mocks.acceptHandoverRequest,
  cancelHandoverRequest: mocks.cancelHandoverRequest,
}))

vi.mock('@/lib/siwe-sign', () => {
  class SiweSignError extends Error {
    code: string
    constructor(code: string) {
      super(code)
      this.code = code
    }
  }
  return { signSiweForAddress: mocks.signSiweForAddress, SiweSignError }
})

import { HandoverWalletControl } from '../HandoverWalletControl'

const REQUEST = {
  id: 9,
  direccion_invitada: A,
  expires_at: null,
  duplicate_id: 42,
  duplicate_nusuario: '0xaaaa…aaaa',
  duplicate_wallet: OLD,
}

describe('HandoverWalletControl (R-#288)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.sessionAddress = A
    mocks.inAppAddress = undefined
    mocks.isInAppUnlocked = false
    mocks.fetchWalletOverview.mockResolvedValue({
      wallets: [{ id: 1, usuario_id: 7, billetera: A }],
      invitations: [],
      receivedInvitations: [],
      verified: true,
    })
    mocks.requestHandover.mockResolvedValue({ ok: true, invitations: [] })
    mocks.acceptHandoverRequest.mockResolvedValue({ ok: true, wallets: [] })
    mocks.cancelHandoverRequest.mockResolvedValue({ ok: true })
    mocks.signSiweForAddress.mockResolvedValue({ message: 'siwe', signature: '0xsig' })
  })

  it('lists a received request and accepts it by signing with the session wallet', async () => {
    mocks.fetchWalletOverview.mockResolvedValue({
      wallets: [{ id: 1, usuario_id: 7, billetera: A }],
      invitations: [],
      receivedInvitations: [REQUEST],
      verified: true,
    })
    const onChanged = vi.fn()
    render(<HandoverWalletControl lang="en" onChanged={onChanged} />)

    await waitFor(() => expect(screen.getByTestId('handover-request')).toBeTruthy())
    fireEvent.click(screen.getByTestId('handover-accept'))

    await waitFor(() => expect(mocks.acceptHandoverRequest).toHaveBeenCalledWith('siwe', '0xsig'))
    expect(mocks.signSiweForAddress).toHaveBeenCalledWith(mocks.provider, A)
    expect(onChanged).toHaveBeenCalled()
    expect(await screen.findByTestId('handover-message')).toHaveTextContent(/wallet added/i)
  })

  it('dismisses a received request without moving the wallet', async () => {
    mocks.fetchWalletOverview.mockResolvedValue({
      wallets: [{ id: 1, usuario_id: 7, billetera: A }],
      invitations: [],
      receivedInvitations: [REQUEST],
      verified: true,
    })
    render(<HandoverWalletControl lang="en" />)

    await waitFor(() => expect(screen.getByTestId('handover-dismiss')).toBeTruthy())
    fireEvent.click(screen.getByTestId('handover-dismiss'))

    await waitFor(() => expect(mocks.cancelHandoverRequest).toHaveBeenCalledWith(A, REQUEST.id))
    expect(mocks.acceptHandoverRequest).not.toHaveBeenCalled()
    expect(mocks.signSiweForAddress).not.toHaveBeenCalled()
    expect(await screen.findByTestId('handover-message')).toHaveTextContent(/request dismissed/i)
  })

  it('offers the request form only when the account is not verified', async () => {
    mocks.fetchWalletOverview.mockResolvedValue({
      wallets: [{ id: 1, usuario_id: 7, billetera: A }],
      invitations: [],
      receivedInvitations: [],
      verified: false,
    })
    render(<HandoverWalletControl lang="es" />)

    await waitFor(() => expect(screen.getByTestId('handover-open')).toBeTruthy())
    fireEvent.click(screen.getByTestId('handover-open'))
    fireEvent.change(screen.getByTestId('handover-address'), { target: { value: OLD } })
    fireEvent.click(screen.getByTestId('handover-send'))

    await waitFor(() => expect(mocks.requestHandover).toHaveBeenCalledWith(A, OLD))
    expect(await screen.findByTestId('handover-message')).toHaveTextContent(/solicitud enviada/i)
  })

  it('does not offer the form on a verified account', async () => {
    render(<HandoverWalletControl lang="en" />)
    await waitFor(() => expect(mocks.fetchWalletOverview).toHaveBeenCalled())
    expect(screen.queryByTestId('handover-open')).toBeNull()
    expect(screen.queryByTestId('handover-requests')).toBeNull()
  })

  it('asks for the in-app unlock instead of signing while it is locked', async () => {
    mocks.inAppAddress = A
    mocks.isInAppUnlocked = false
    mocks.fetchWalletOverview.mockResolvedValue({
      wallets: [{ id: 1, usuario_id: 7, billetera: A }],
      invitations: [],
      receivedInvitations: [REQUEST],
      verified: true,
    })
    const onUnlock = vi.fn()
    render(<HandoverWalletControl lang="en" onUnlock={onUnlock} />)

    await waitFor(() => expect(screen.getByTestId('handover-accept')).toBeTruthy())
    fireEvent.click(screen.getByTestId('handover-accept'))

    await waitFor(() => expect(onUnlock).toHaveBeenCalled())
    expect(mocks.signSiweForAddress).not.toHaveBeenCalled()
    expect(mocks.acceptHandoverRequest).not.toHaveBeenCalled()
  })
})
