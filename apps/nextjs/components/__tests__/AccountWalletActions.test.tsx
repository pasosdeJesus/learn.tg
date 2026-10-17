// @vitest-environment jsdom
import * as React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const A = '0x' + 'a'.repeat(40)
const B = '0x' + 'b'.repeat(40)

const mocks = vi.hoisted(() => ({
  status: 'no-wallet' as string,
  inAppAddress: undefined as string | undefined,
  sessionAddress: ('0x' + 'a'.repeat(40)) as string | undefined,
  externalAvailable: false,
  announced: [] as unknown[],
  ethAccounts: vi.fn(),
}))

vi.mock('@pasosdejesus/m/wallet/next', () => ({
  useInAppWallet: () => ({
    status: mocks.status,
    walletInfo: mocks.inAppAddress ? { address: mocks.inAppAddress } : null,
  }),
}))

vi.mock('@/lib/hooks/useAuthAddress', () => ({
  useAuthAddress: () => ({ address: mocks.sessionAddress, sessionAddress: mocks.sessionAddress }),
}))

vi.mock('@/lib/external-provider', () => ({
  useExternalProvider: () => ({ available: mocks.externalAvailable, announced: mocks.announced }),
  getExternalProvider: () => (mocks.externalAvailable ? { request: mocks.ethAccounts } : null),
}))

// Sólo se prueba el gating y la composición; los botones ya tienen sus pruebas.
vi.mock('../LinkWalletButton', () => ({
  LinkWalletButton: (props: { align?: string }) =>
    React.createElement('span', { 'data-testid': 'link-mock', 'data-align': props.align }),
}))
vi.mock('../InviteWalletControl', () => ({
  InviteWalletControl: (props: { align?: string }) =>
    React.createElement('span', { 'data-testid': 'invite-mock', 'data-align': props.align }),
}))

import { AccountWalletActions } from '../AccountWalletActions'

describe('AccountWalletActions (R-#265 §3.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.status = 'no-wallet'
    mocks.inAppAddress = undefined
    mocks.sessionAddress = A
    mocks.externalAvailable = false
    mocks.announced = []
    mocks.ethAccounts.mockResolvedValue([])
  })

  it('sin otra billetera detectada sólo ofrece invitar', async () => {
    mocks.externalAvailable = true
    mocks.ethAccounts.mockResolvedValue([A])
    render(<AccountWalletActions lang="en" />)

    await waitFor(() => expect(mocks.ethAccounts).toHaveBeenCalled())
    expect(screen.queryByTestId('link-mock')).toBeNull()
    expect(screen.getByTestId('invite-mock')).toBeTruthy()
  })

  it('muestra vincular cuando la billetera de la aplicación no es la de la sesión', async () => {
    mocks.status = 'locked'
    mocks.inAppAddress = B
    render(<AccountWalletActions lang="en" />)

    expect(screen.getByTestId('link-mock')).toBeTruthy()
    expect(screen.getByTestId('invite-mock')).toBeTruthy()
  })

  it('muestra vincular cuando la sesión es la billetera de la aplicación y hay una externa', async () => {
    mocks.status = 'unlocked'
    mocks.inAppAddress = A
    mocks.externalAvailable = true
    mocks.ethAccounts.mockResolvedValue([])
    render(<AccountWalletActions lang="en" />)

    await waitFor(() => expect(screen.getByTestId('link-mock')).toBeTruthy())
  })

  it('no pinta nada sin sesión', () => {
    mocks.sessionAddress = undefined
    const { container } = render(<AccountWalletActions lang="en" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('alinea las acciones al inicio del contenedor', () => {
    render(<AccountWalletActions lang="es" />)
    expect(screen.getByTestId('invite-mock').getAttribute('data-align')).toBe('start')
  })
})
