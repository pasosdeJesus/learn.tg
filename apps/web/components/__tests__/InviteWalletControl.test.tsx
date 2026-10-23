// @vitest-environment jsdom
import * as React from 'react'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  sessionAddress: '0xaaa' as string | undefined,
  fetchAccountInvitations: vi.fn(),
  inviteWalletAddress: vi.fn(),
  cancelInvitationRequest: vi.fn(),
  toast: vi.fn(),
}))

vi.mock('@/lib/hooks/useAuthAddress', () => ({
  useAuthAddress: () => ({ sessionAddress: mocks.sessionAddress }),
}))

vi.mock('@pasosdejesus/m/shadcn-components/ui/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}))

vi.mock('@/lib/wallet-account', () => ({
  fetchAccountInvitations: (...args: unknown[]) => mocks.fetchAccountInvitations(...args),
  inviteWalletAddress: (...args: unknown[]) => mocks.inviteWalletAddress(...args),
  cancelInvitationRequest: (...args: unknown[]) => mocks.cancelInvitationRequest(...args),
}))

import { InviteWalletControl } from '../InviteWalletControl'

const INVITATION = {
  id: 1,
  direccion_invitada: '0xcccccccccccccccccccccccccccccccccccccccc',
  usuario_id: 7,
  expires_at: '2026-11-01T00:00:00Z',
}

describe('InviteWalletControl (R-#265 §3.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.sessionAddress = '0xaaa'
    mocks.fetchAccountInvitations.mockResolvedValue([])
  })

  afterEach(() => cleanup())

  it('invites an address, closes the panel and confirms with a toast', async () => {
    mocks.inviteWalletAddress.mockResolvedValue({ ok: true, invitations: [INVITATION] })
    const onClose = vi.fn()
    render(<InviteWalletControl lang="en" onClose={onClose} />)

    await act(async () => {
      fireEvent.click(screen.getByTestId('wallet-invite-toggle'))
    })
    await act(async () => {
      fireEvent.change(screen.getByTestId('wallet-invite-address'), {
        target: { value: INVITATION.direccion_invitada },
      })
      fireEvent.click(screen.getByTestId('wallet-invite-submit'))
    })

    expect(mocks.inviteWalletAddress).toHaveBeenCalledWith('0xaaa', INVITATION.direccion_invitada)
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Invitation sent',
        description: expect.stringMatching(/accept it when it signs in/i),
      }),
    )
    expect(onClose).toHaveBeenCalled()
    // El panel se cierra: la invitación queda en el contador del botón.
    expect(screen.queryByTestId('wallet-invite-panel')).toBeNull()
    expect(screen.getByTestId('wallet-invite-toggle')).toHaveTextContent('(1)')
  })

  it('explains that the inviter needs a verified profile', async () => {
    mocks.inviteWalletAddress.mockResolvedValue({ ok: false, reason: 'unverified' })
    render(<InviteWalletControl lang="en" />)

    await act(async () => {
      fireEvent.click(screen.getByTestId('wallet-invite-toggle'))
    })
    await act(async () => {
      fireEvent.change(screen.getByTestId('wallet-invite-address'), {
        target: { value: INVITATION.direccion_invitada },
      })
      fireEvent.click(screen.getByTestId('wallet-invite-submit'))
    })

    expect(screen.getByTestId('wallet-invite-message')).toHaveTextContent(/50 points/i)
  })

  it('lists and cancels a pending invitation', async () => {
    mocks.fetchAccountInvitations.mockResolvedValue([INVITATION])
    mocks.cancelInvitationRequest.mockResolvedValue({ ok: true, cancelled: true, invitations: [] })
    render(<InviteWalletControl lang="es" />)

    await act(async () => {
      fireEvent.click(screen.getByTestId('wallet-invite-toggle'))
    })

    expect(screen.getByTestId('wallet-invitation')).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByTestId('wallet-invite-cancel'))
    })

    expect(mocks.cancelInvitationRequest).toHaveBeenCalledWith(
      '0xaaa',
      INVITATION.direccion_invitada,
    )
    expect(screen.getByTestId('wallet-invite-message')).toHaveTextContent(/cancelada/i)
    expect(screen.queryByTestId('wallet-invitation')).not.toBeInTheDocument()
  })

  it('renders nothing without a session', () => {
    mocks.sessionAddress = undefined
    const { container } = render(<InviteWalletControl lang="en" />)
    expect(container).toBeEmptyDOMElement()
  })
})
