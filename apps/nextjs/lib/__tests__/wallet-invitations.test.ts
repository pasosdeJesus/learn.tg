import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  probeInvitation: vi.fn(),
  acceptInvitationRequest: vi.fn(),
}))

vi.mock('@/lib/wallet-account', () => ({
  probeInvitation: (...args: unknown[]) => mocks.probeInvitation(...args),
  acceptInvitationRequest: (...args: unknown[]) => mocks.acceptInvitationRequest(...args),
}))

import { invitationPrompt, resolveInvitationAfterAuthFailure } from '@/lib/wallet-invitations'

describe('wallet-invitations (R-#265 §3.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('names the inviting account in the confirmation, in both languages', () => {
    expect(invitationPrompt('en', 'ana')).toContain('"ana"')
    expect(invitationPrompt('es', 'ana')).toContain('"ana"')
    expect(invitationPrompt('en', null)).toMatch(/another account/i)
    expect(invitationPrompt('es', null)).toMatch(/otra cuenta/i)
  })

  it('does nothing when the wallet has no pending invitation', async () => {
    mocks.probeInvitation.mockResolvedValue({ ok: false, reason: 'no-invitation' })
    const confirm = vi.fn()

    const outcome = await resolveInvitationAfterAuthFailure({
      message: 'm',
      signature: 's',
      confirm,
    })

    expect(outcome).toBe('none')
    expect(confirm).not.toHaveBeenCalled()
    expect(mocks.acceptInvitationRequest).not.toHaveBeenCalled()
  })

  it('reports an error when the probe itself fails', async () => {
    mocks.probeInvitation.mockResolvedValue({ ok: false, reason: 'error' })

    expect(
      await resolveInvitationAfterAuthFailure({ message: 'm', signature: 's', confirm: vi.fn() }),
    ).toBe('error')
  })

  it('does not link when the learner declines the invitation', async () => {
    mocks.probeInvitation.mockResolvedValue({ ok: true, invitedBy: 'ana' })
    const confirm = vi.fn(() => false)

    const outcome = await resolveInvitationAfterAuthFailure({
      message: 'm',
      signature: 's',
      confirm,
    })

    expect(outcome).toBe('declined')
    expect(confirm).toHaveBeenCalledWith('ana')
    expect(mocks.acceptInvitationRequest).not.toHaveBeenCalled()
  })

  it('links the wallet and asks the caller to retry the sign-in when accepted', async () => {
    mocks.probeInvitation.mockResolvedValue({ ok: true, invitedBy: 'ana' })
    mocks.acceptInvitationRequest.mockResolvedValue({ ok: true, invitedBy: 'ana' })

    const outcome = await resolveInvitationAfterAuthFailure({
      message: 'm',
      signature: 's',
      confirm: async () => true,
    })

    expect(outcome).toBe('accepted')
    expect(mocks.acceptInvitationRequest).toHaveBeenCalledWith('m', 's')
  })

  it('reports an error when the acceptance fails (expired or owned by another account)', async () => {
    mocks.probeInvitation.mockResolvedValue({ ok: true, invitedBy: 'ana' })
    mocks.acceptInvitationRequest.mockResolvedValue({ ok: false, reason: 'owned-by-other' })

    expect(
      await resolveInvitationAfterAuthFailure({ message: 'm', signature: 's', confirm: () => true }),
    ).toBe('error')
  })
})
