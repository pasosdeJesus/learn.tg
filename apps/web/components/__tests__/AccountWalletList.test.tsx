// @vitest-environment jsdom
import * as React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetchAccountWallets: vi.fn(),
}))

vi.mock('@/lib/wallet-account', () => ({
  fetchAccountWallets: mocks.fetchAccountWallets,
}))

import { AccountWalletList } from '../AccountWalletList'

const SESSION = '0x1111111111111111111111111111111111111111'
const INAPP = '0x2222222222222222222222222222222222222222'
const WALLETS = [
  { id: 1, usuario_id: 7, billetera: SESSION, linked_at: '2026-01-01T00:00:00Z' },
  { id: 2, usuario_id: 7, billetera: INAPP, linked_at: '2026-02-01T00:00:00Z' },
]

describe('AccountWalletList (R-#288)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchAccountWallets.mockResolvedValue(WALLETS)
  })

  it('lists every wallet of the account, like the panel Accounts tab', async () => {
    render(
      <AccountWalletList
        lang="en"
        address={SESSION}
        sessionAddress={SESSION}
        inAppAddress={INAPP}
      />,
    )

    await waitFor(() => expect(screen.getByTestId('account-wallet-list')).toBeInTheDocument())
    expect(screen.getByTestId(`account-wallet-${SESSION}`)).toHaveTextContent(/0x1111…1111/)
    expect(screen.getByTestId(`account-wallet-${INAPP}`)).toHaveTextContent(/0x2222…2222/)
    expect(screen.getByTestId(`account-wallet-${SESSION}`)).toHaveTextContent(/this device/i)
    expect(screen.getByTestId(`account-wallet-${INAPP}`)).toHaveTextContent(/in-app/i)
  })

  it('reads the list again when refreshKey changes', async () => {
    const { rerender } = render(
      <AccountWalletList lang="en" address={SESSION} refreshKey={0} />,
    )
    await waitFor(() => expect(mocks.fetchAccountWallets).toHaveBeenCalledTimes(1))

    rerender(<AccountWalletList lang="en" address={SESSION} refreshKey={1} />)
    await waitFor(() => expect(mocks.fetchAccountWallets).toHaveBeenCalledTimes(2))
  })

  it('says so when the account has no wallets', async () => {
    mocks.fetchAccountWallets.mockResolvedValue([])
    render(<AccountWalletList lang="es" address={SESSION} />)
    await waitFor(() =>
      expect(screen.getByTestId('account-wallet-list-empty')).toHaveTextContent(/no se encontraron/i),
    )
  })
})
