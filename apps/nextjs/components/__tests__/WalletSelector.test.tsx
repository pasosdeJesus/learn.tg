// @vitest-environment jsdom
import * as React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { beforeEach, describe, it, expect, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  status: 'no-wallet' as string,
  lock: vi.fn(),
  signOut: vi.fn(),
  sessionAddress: undefined as string | undefined,
  inAppAddress: undefined as string | undefined,
  isInAppUnlocked: false,
  isSessionLoading: false,
  dialogOpen: false,
}))

vi.mock('@learn-tg/pdj-wallet-next', () => ({
  useInAppWallet: () => ({ status: mocks.status, lock: mocks.lock }),
}))

vi.mock('next-auth/react', () => ({
  signOut: (...args: unknown[]) => mocks.signOut(...args),
}))

vi.mock('@/lib/hooks/useAuthAddress', () => ({
  useAuthAddress: () => ({
    address: mocks.sessionAddress ?? mocks.inAppAddress,
    sessionAddress: mocks.sessionAddress,
    inAppAddress: mocks.inAppAddress,
    isInAppUnlocked: mocks.isInAppUnlocked,
    isSessionLoading: mocks.isSessionLoading,
  }),
}))

vi.mock('@/components/WalletDialog', () => ({
  WalletDialog: ({ open }: { open: boolean }) => {
    mocks.dialogOpen = open
    return open ? React.createElement('div', { 'data-testid': 'wallet-dialog-open' }) : null
  },
}))

vi.mock('@/components/ConnectWalletButton', () => ({
  ConnectWalletButton: () => React.createElement('div', { 'data-testid': 'connect-wallet-btn' }),
}))

import { WalletSelector } from '../WalletSelector'
import { OPEN_IN_APP_WALLET_DIALOG } from '@/lib/in-app-wallet-dialog'

const ADDRESS = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'

describe('WalletSelector (R-#238/R-#244)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.status = 'no-wallet'
    mocks.sessionAddress = undefined
    mocks.inAppAddress = undefined
    mocks.isInAppUnlocked = false
    mocks.dialogOpen = false
    Object.defineProperty(window, 'ethereum', { value: undefined, configurable: true })
  })

  it('offers the in-app wallet and opens the dialog', async () => {
    render(<WalletSelector lang="en" />)
    const button = screen.getByTestId('wallet-open-dialog')
    expect(button).toHaveTextContent(/use in-app wallet/i)

    await act(async () => {
      fireEvent.click(button)
    })
    expect(screen.getByTestId('wallet-dialog-open')).toBeInTheDocument()
  })

  it('asks to unlock when the wallet is locked', () => {
    mocks.status = 'locked'
    render(<WalletSelector lang="en" />)
    expect(screen.getByTestId('wallet-open-dialog')).toHaveTextContent(/unlock your in-app wallet/i)
  })

  it('asks to sign in when the wallet is unlocked but there is no session', () => {
    mocks.status = 'unlocked'
    mocks.isInAppUnlocked = true
    mocks.inAppAddress = ADDRESS
    render(<WalletSelector lang="en" />)
    expect(screen.getByTestId('wallet-open-dialog')).toHaveTextContent(/sign in with in-app wallet/i)
  })

  it('shows the address and signs out when there is a session', async () => {
    mocks.status = 'unlocked'
    mocks.isInAppUnlocked = true
    mocks.inAppAddress = ADDRESS
    mocks.sessionAddress = ADDRESS
    render(<WalletSelector lang="en" />)

    expect(screen.getByTestId('wallet-selector-in-app')).toHaveTextContent(/0xf39f…2266/)
    await act(async () => {
      fireEvent.click(screen.getByTestId('wallet-disconnect'))
    })
    expect(mocks.lock).toHaveBeenCalled()
    expect(mocks.signOut).toHaveBeenCalledWith({ redirect: true, callbackUrl: '/en' })
  })

  // Tras el SIWE la página recarga y la billetera queda bloqueada: la cabecera
  // debe seguir mostrando la sesión, no volver a pedir "Unlock".
  it('keeps showing the session when the in-app wallet is locked again after a reload', () => {
    mocks.status = 'locked'
    mocks.isInAppUnlocked = false
    mocks.inAppAddress = undefined
    mocks.sessionAddress = ADDRESS
    render(<WalletSelector lang="en" />)

    expect(screen.getByTestId('wallet-selector-in-app')).toHaveTextContent(/0xf39f…2266/)
    expect(screen.queryByTestId('wallet-open-dialog')).not.toBeInTheDocument()
  })

  // R-#244: con sesión y billetera bloqueada el encabezado muestra la dirección,
  // pero el diálogo debe seguir montado: es el único que atiende el evento de los
  // modales de donación/compra (reportado el 2026-09-16: el botón no hacía nada).
  it('opens the dialog from the outside event while showing a session', async () => {
    mocks.status = 'locked'
    mocks.isInAppUnlocked = false
    mocks.sessionAddress = ADDRESS
    render(<WalletSelector lang="en" />)

    await act(async () => {
      window.dispatchEvent(new Event(OPEN_IN_APP_WALLET_DIALOG))
    })
    expect(screen.getByTestId('wallet-dialog-open')).toBeInTheDocument()
  })

  it('offers the external wallet only when the browser injects one', () => {
    render(<WalletSelector lang="en" />)
    expect(screen.queryByTestId('wallet-use-external')).not.toBeInTheDocument()

    Object.defineProperty(window, 'ethereum', { value: { request: vi.fn() }, configurable: true })
    render(<WalletSelector lang="en" />)
    const external = screen.getAllByTestId('wallet-use-external')[0]
    expect(external).toHaveTextContent(/use external wallet/i)

    fireEvent.click(external)
    expect(screen.getByTestId('connect-wallet-btn')).toBeInTheDocument()
  })

  it('is bilingual', () => {
    render(<WalletSelector lang="es" />)
    expect(screen.getByTestId('wallet-open-dialog')).toHaveTextContent(/billetera de la aplicación/i)
  })

  // R-#238: mientras el estado es 'loading' no se sabe si hay billetera; decir
  // "Use in-app wallet" (o "Unlock") confundía al operador.
  it('shows a neutral, disabled button while the wallet status is loading', () => {
    mocks.status = 'loading'
    render(<WalletSelector lang="en" />)

    expect(screen.getByTestId('wallet-open-dialog')).toHaveTextContent(/^In-app wallet$/i)
    expect(screen.getByTestId('wallet-open-dialog')).toBeDisabled()
  })

  it('does not ask to unlock while the NextAuth session is still loading', () => {
    mocks.status = 'locked'
    mocks.isInAppUnlocked = false
    mocks.sessionAddress = undefined
    mocks.isSessionLoading = true
    render(<WalletSelector lang="en" />)

    expect(screen.getByTestId('wallet-open-dialog')).toHaveTextContent(/^In-app wallet$/i)
    expect(screen.getByTestId('wallet-open-dialog')).toBeDisabled()
  })
})
