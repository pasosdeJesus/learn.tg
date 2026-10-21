// @vitest-environment jsdom
import * as React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { beforeEach, describe, it, expect, vi } from 'vitest'

// R-#265 §3.2: el botón firma con la billetera **activa**. Se aíslan el hook de la
// billetera de la aplicación, el proveedor externo, la sesión y el cliente de enlace.
const mocks = vi.hoisted(() => ({
  status: 'unlocked' as string,
  inAppAddress: '0x2222222222222222222222222222222222222222' as string | undefined,
  sessionAddress: '0x1111111111111111111111111111111111111111' as string | undefined,
  detectActiveWalletSigner: vi.fn(),
  linkActiveWallet: vi.fn(),
}))

vi.mock('@pasosdejesus/m/wallet/next', () => ({
  useInAppWallet: () => ({
    status: mocks.status,
    walletInfo: mocks.inAppAddress ? { address: mocks.inAppAddress } : null,
    getProvider: () => ({ request: vi.fn() }),
  }),
}))

vi.mock('@/lib/external-provider', () => ({ getExternalProvider: () => null }))
vi.mock('@/lib/rpc-url', () => ({ getRpcUrl: () => 'http://rpc.test' }))
vi.mock('@/lib/hooks/useAuthAddress', () => ({
  useAuthAddress: () => ({ address: mocks.sessionAddress, sessionAddress: mocks.sessionAddress }),
}))
vi.mock('@/lib/wallet-link', () => ({
  detectActiveWalletSigner: mocks.detectActiveWalletSigner,
  linkActiveWallet: mocks.linkActiveWallet,
}))

import { LinkWalletButton } from '../LinkWalletButton'

const click = async (testId = 'wallet-link') => {
  await act(async () => {
    fireEvent.click(screen.getByTestId(testId))
  })
}

describe('LinkWalletButton (R-#265 §3.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.status = 'unlocked'
    mocks.inAppAddress = '0x2222222222222222222222222222222222222222'
    mocks.sessionAddress = '0x1111111111111111111111111111111111111111'
  })

  it('links with the active wallet and reports success', async () => {
    mocks.detectActiveWalletSigner.mockResolvedValue({
      ok: true,
      signer: { address: mocks.inAppAddress, provider: {} },
    })
    mocks.linkActiveWallet.mockResolvedValue({ ok: true, wallets: [] })
    render(<LinkWalletButton lang="en" />)

    await click()

    expect(mocks.linkActiveWallet).toHaveBeenCalledWith(
      expect.objectContaining({ sessionWallet: mocks.sessionAddress }),
    )
    expect(screen.getByTestId('wallet-link-message')).toHaveTextContent(/linked to your account/i)
  })

  it('explains when the active wallet is already part of the account', async () => {
    mocks.detectActiveWalletSigner.mockResolvedValue({ ok: false, reason: 'is-session-wallet' })
    render(<LinkWalletButton lang="en" />)

    await click()

    expect(mocks.linkActiveWallet).not.toHaveBeenCalled()
    expect(screen.getByTestId('wallet-link-message')).toHaveTextContent(/already in your account/i)
  })

  it('explains when there is no wallet able to sign', async () => {
    mocks.detectActiveWalletSigner.mockResolvedValue({ ok: false, reason: 'no-wallet' })
    render(<LinkWalletButton lang="en" />)

    await click()

    expect(screen.getByTestId('wallet-link-message')).toHaveTextContent(/no wallet can sign yet/i)
  })

  it('reports a wallet that belongs to another account', async () => {
    mocks.detectActiveWalletSigner.mockResolvedValue({
      ok: true,
      signer: { address: mocks.inAppAddress, provider: {} },
    })
    mocks.linkActiveWallet.mockResolvedValue({ ok: false, reason: 'owned-by-other' })
    render(<LinkWalletButton lang="en" />)

    await click()

    expect(screen.getByTestId('wallet-link-message')).toHaveTextContent(/belongs to another account/i)
  })

  it('explains a cancelled access request', async () => {
    mocks.detectActiveWalletSigner.mockResolvedValue({ ok: false, reason: 'cancelled' })
    render(<LinkWalletButton lang="en" />)

    await click()

    expect(screen.getByTestId('wallet-link-message')).toHaveTextContent(/did not grant access/i)
  })

  it('uses Spanish when the language is es', async () => {
    mocks.detectActiveWalletSigner.mockResolvedValue({ ok: false, reason: 'is-session-wallet' })
    render(<LinkWalletButton lang="es" />)

    expect(screen.getByTestId('wallet-link')).toHaveTextContent(/vincular otra billetera/i)
    await click()
    expect(screen.getByTestId('wallet-link-message')).toHaveTextContent(/ya está en tu cuenta/i)
  })
})
