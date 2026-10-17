// @vitest-environment jsdom
import * as React from 'react'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
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
  panelOpen: false,
  panelAddress: '',
  onRequestUnlock: undefined as (() => void) | undefined,
  externalAvailable: false,
}))

vi.mock('@pasosdejesus/m/wallet/next', () => ({
  useInAppWallet: () => ({ status: mocks.status, lock: mocks.lock, getProvider: () => null }),
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

vi.mock('@/lib/external-provider', () => ({
  useExternalProvider: () => ({
    provider: mocks.externalAvailable ? { request: vi.fn() } : null,
    available: mocks.externalAvailable,
  }),
}))

vi.mock('@/components/WalletPanel', () => ({
  WalletPanel: ({ open, address, onRequestUnlock }: { open: boolean; address: string; onRequestUnlock?: () => void }) => {
    mocks.panelOpen = open
    mocks.panelAddress = address
    mocks.onRequestUnlock = onRequestUnlock
    return open ? React.createElement('div', { 'data-testid': 'wallet-panel-open' }) : null
  },
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

// R-#265 §3.9: el header usa `WalletConnect` del motor `wallet`; el cuerpo se
// sobrecarga con `renderBody`. El mock lo pinta directamente para probar las acciones.
vi.mock('generated-wallet/next', () => ({
  WalletConnect: ({ renderBody }: any) =>
    React.createElement(
      'div',
      { 'data-testid': 'wallet-connect' },
      React.createElement('button', { 'data-testid': 'connect-wallet' }),
      renderBody
        ? renderBody({ lang: 'en', close: () => {}, connectExternal: async () => {}, externalError: null })
        : null,
    ),
}))

import { WalletSelector } from '../WalletSelector'
import { OPEN_IN_APP_WALLET_DIALOG } from '@/lib/in-app-wallet-dialog'

const ADDRESS = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'
const DESKTOP_CHROME = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
const ORIGINAL_UA = navigator.userAgent

describe('WalletSelector (R-#238/R-#244)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.status = 'no-wallet'
    mocks.sessionAddress = undefined
    mocks.inAppAddress = undefined
    mocks.isInAppUnlocked = false
    mocks.dialogOpen = false
    mocks.panelOpen = false
    mocks.panelAddress = ''
    mocks.externalAvailable = false
    window.history.pushState({}, '', '/en')
    Object.defineProperty(navigator, 'userAgent', { value: ORIGINAL_UA, configurable: true })
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
  it('keeps showing the session when the in-app wallet is locked again after a reload', async () => {
    mocks.status = 'locked'
    mocks.isInAppUnlocked = false
    mocks.inAppAddress = undefined
    mocks.sessionAddress = ADDRESS
    render(<WalletSelector lang="en" />)

    expect(screen.getByTestId('wallet-selector-in-app')).toHaveTextContent(/0xf39f…2266/)
    // R-#246/R-#265: la dirección es la entrada al panel; con la billetera bloqueada
    // el panel se abre igual y ofrece desbloquear (antes pedía desbloquear dos veces).
    const pill = screen.getByTestId('wallet-open-dialog')
    expect(pill).toHaveTextContent(/0xf39f…2266/)
    await act(async () => {
      fireEvent.click(pill)
    })
    expect(screen.getByTestId('wallet-panel-open')).toBeInTheDocument()
  })

  // R-#244: con sesión y billetera bloqueada el encabezado muestra la dirección,
  // pero el diálogo debe seguir montado: es el único que atiende el evento de los
  // modales de donación/compra (reportado el 2026-09-16: el botón no hacía nada).
  // R-#249/R-#265: la píldora abre siempre el panel; cuando la billetera está
  // bloqueada el panel pide desbloquear a través de `onRequestUnlock`.
  it('opens the panel with a session and asks for unlock from the panel when locked', async () => {
    mocks.status = 'unlocked'
    mocks.isInAppUnlocked = true
    mocks.inAppAddress = ADDRESS
    mocks.sessionAddress = ADDRESS
    render(<WalletSelector lang="en" />)

    await act(async () => {
      fireEvent.click(screen.getByTestId('wallet-open-dialog'))
    })
    expect(screen.getByTestId('wallet-panel-open')).toBeInTheDocument()
    expect(mocks.panelAddress.toLowerCase()).toBe(ADDRESS)

    cleanup()
    mocks.isInAppUnlocked = false
    mocks.inAppAddress = undefined
    mocks.status = 'locked'
    render(<WalletSelector lang="en" />)

    await act(async () => {
      fireEvent.click(screen.getByTestId('wallet-open-dialog'))
    })
    expect(screen.getByTestId('wallet-panel-open')).toBeInTheDocument()
    expect(screen.queryByTestId('wallet-dialog-open')).not.toBeInTheDocument()
    // El panel ofrece desbloquear; eso abre el diálogo.
    await act(async () => {
      mocks.onRequestUnlock?.()
    })
    expect(screen.getByTestId('wallet-dialog-open')).toBeInTheDocument()
  })

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

  // R-#270 §3.1: la billetera de la aplicación es la opción por defecto; la externa
  // manda sólo en el navegador propio de una billetera (R-#246 §3).
  it('defaults to the in-app wallet with an injected provider, and to the external one in a wallet browser', () => {
    mocks.externalAvailable = false
    render(<WalletSelector lang="en" />)
    expect(screen.getByTestId('wallet-open-dialog')).toHaveTextContent(/use in-app wallet/i)
    expect(screen.queryByTestId('connect-wallet-btn')).not.toBeInTheDocument()

    // Chrome de escritorio con la extensión inyectada (`isMetaMask`): NO es el navegador
    // propio de la billetera, así que la in-app sigue siendo la principal (R-#270 §11.1).
    cleanup()
    mocks.externalAvailable = true
    Object.defineProperty(navigator, 'userAgent', { value: DESKTOP_CHROME, configurable: true })
    Object.defineProperty(window, 'ethereum', { value: { isMetaMask: true }, configurable: true })
    render(<WalletSelector lang="en" />)
    expect(screen.getByTestId('wallet-selector')).toBeInTheDocument()
    expect(screen.getByTestId('wallet-open-dialog')).toBeInTheDocument()
    // R-#265 §3.9: la elección externa vive dentro del `WalletConnect` del motor y
    // delega en `ConnectWalletButton` (flujo real de red + SIWE).
    expect(screen.getByTestId('connect-wallet-btn')).toBeInTheDocument()
    expect(screen.getByTestId('wallet-import-hint')).toHaveTextContent(/import your recovery phrase/i)

    // Navegador propio de MetaMask: la externa va primero en el modal, con la in-app
    // como alternativa (preferencia del operador: un solo botón + un modal).
    cleanup()
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (Linux; Android 13) MetaMask/7.0', configurable: true })
    render(<WalletSelector lang="en" />)
    expect(screen.getByTestId('wallet-selector')).toHaveAttribute('data-external-primary', 'true')
    expect(screen.getByTestId('connect-wallet-btn')).toBeInTheDocument()
    expect(screen.getByTestId('wallet-open-dialog')).toHaveTextContent(/use in-app wallet/i)
    expect(screen.getByTestId('wallet-browser-note')).toBeInTheDocument()

    // `?iappwallet=1` vuelve a poner la in-app primero incluso en un navegador de billetera.
    cleanup()
    window.history.pushState({}, '', '/en?iappwallet=1')
    render(<WalletSelector lang="en" />)
    expect(screen.getByTestId('wallet-selector')).toHaveAttribute('data-external-primary', 'false')
    expect(screen.getByTestId('connect-wallet-btn')).toBeInTheDocument()
    expect(screen.getByTestId('wallet-open-dialog')).toBeInTheDocument()
  })

  // Si este dispositivo ya tiene billetera de la aplicación, su interfaz se
  // conserva aunque haya billetera inyectada: no se puede dejar inaccesible.
  it('keeps the in-app interface when this device already has one', () => {
    mocks.externalAvailable = true
    mocks.status = 'locked'
    render(<WalletSelector lang="en" />)

    expect(screen.getByTestId('wallet-open-dialog')).toHaveTextContent(/unlock your in-app wallet/i)
  })

  it('is bilingual', () => {
    render(<WalletSelector lang="es" />)
    expect(screen.getByTestId('wallet-open-dialog')).toHaveTextContent(/billetera de la aplicación/i)
  })

  // R-#238: mientras el estado es 'loading' no se sabe si hay billetera; decir
  // "Use in-app wallet" (o "Unlock") confundía al operador.
  it('shows a neutral message while the wallet status is loading', () => {
    mocks.status = 'loading'
    render(<WalletSelector lang="en" />)

    expect(screen.getByTestId('wallet-connect')).toHaveTextContent(/^In-app wallet$/i)
    expect(screen.queryByTestId('wallet-open-dialog')).not.toBeInTheDocument()
  })

  it('does not ask to unlock while the NextAuth session is still loading', () => {
    mocks.status = 'locked'
    mocks.isInAppUnlocked = false
    mocks.sessionAddress = undefined
    mocks.isSessionLoading = true
    render(<WalletSelector lang="en" />)

    expect(screen.getByTestId('wallet-connect')).toHaveTextContent(/^In-app wallet$/i)
    expect(screen.queryByTestId('wallet-open-dialog')).not.toBeInTheDocument()
  })
})
