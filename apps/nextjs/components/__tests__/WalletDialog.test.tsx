// @vitest-environment jsdom
import * as React from 'react'
import { render, screen, act, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { beforeEach, describe, it, expect, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  status: 'no-wallet' as string,
  walletInfo: null as { address: string } | null,
  error: null as string | null,
  create: vi.fn(),
  importExisting: vi.fn(),
  unlock: vi.fn(),
  remove: vi.fn(),
  getProvider: vi.fn(),
  signInWithInAppWallet: vi.fn(),
  reload: vi.fn(),
}))

vi.mock('@learn-tg/pdj-wallet-next', () => ({
  useInAppWallet: () => ({
    status: mocks.status,
    walletInfo: mocks.walletInfo,
    error: mocks.error,
    create: mocks.create,
    importExisting: mocks.importExisting,
    unlock: mocks.unlock,
    remove: mocks.remove,
    getProvider: mocks.getProvider,
  }),
}))

vi.mock('@/lib/in-app-siwe', () => ({
  signInWithInAppWallet: mocks.signInWithInAppWallet,
}))

Object.defineProperty(window, 'location', {
  value: { ...window.location, reload: mocks.reload },
  configurable: true,
})

import { WalletDialog } from '../WalletDialog'

const ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

function renderDialog(lang = 'en') {
  return render(<WalletDialog lang={lang} open onOpenChange={vi.fn()} />)
}

async function fillPin(pin = '123456') {
  fireEvent.change(screen.getByTestId('wallet-pin'), { target: { value: pin } })
  if (screen.queryByTestId('wallet-pin-confirm')) {
    fireEvent.change(screen.getByTestId('wallet-pin-confirm'), { target: { value: pin } })
  }
}

describe('WalletDialog (R-#244)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.status = 'no-wallet'
    mocks.walletInfo = null
    mocks.error = null
  })

  it('creates the wallet and shows the 12 words with a confirmation', async () => {
    mocks.create.mockResolvedValue({
      walletInfo: { address: ADDRESS },
      mnemonic: 'one two three four five six seven eight nine ten eleven twelve',
    })
    renderDialog()

    await fillPin()
    await act(async () => {
      fireEvent.click(screen.getByTestId('wallet-create'))
    })

    expect(mocks.create).toHaveBeenCalledWith('123456')
    const words = screen.getByTestId('wallet-recovery-words')
    expect(words.querySelectorAll('li')).toHaveLength(12)
    // Todavía no firma: primero se respaldan las palabras
    expect(mocks.signInWithInAppWallet).not.toHaveBeenCalled()
    expect(screen.getByTestId('wallet-signin')).toBeInTheDocument()
  })

  it('does not create the wallet when the PINs differ', async () => {
    renderDialog()
    fireEvent.change(screen.getByTestId('wallet-pin'), { target: { value: '123456' } })
    fireEvent.change(screen.getByTestId('wallet-pin-confirm'), { target: { value: '654321' } })
    await act(async () => {
      fireEvent.click(screen.getByTestId('wallet-create'))
    })
    expect(mocks.create).not.toHaveBeenCalled()
    expect(screen.getByTestId('wallet-dialog-error')).toHaveTextContent(/do not match/i)
  })

  it('rejects a PIN shorter than six digits', async () => {
    renderDialog()
    await fillPin('123')
    await act(async () => {
      fireEvent.click(screen.getByTestId('wallet-create'))
    })
    expect(mocks.create).not.toHaveBeenCalled()
    expect(screen.getByTestId('wallet-dialog-error')).toHaveTextContent(/6 digits/i)
  })

  it('signs in (SIWE) after the user confirms the recovery phrase', async () => {
    mocks.create.mockResolvedValue({
      walletInfo: { address: ADDRESS },
      mnemonic: 'one two three four five six seven eight nine ten eleven twelve',
    })
    mocks.getProvider.mockReturnValue({ request: vi.fn() })
    mocks.signInWithInAppWallet.mockResolvedValue(ADDRESS)
    renderDialog()

    await fillPin()
    await act(async () => {
      fireEvent.click(screen.getByTestId('wallet-create'))
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('wallet-signin'))
    })

    expect(mocks.signInWithInAppWallet).toHaveBeenCalled()
    expect(mocks.reload).toHaveBeenCalled()
  })

  it('unlocks an existing wallet and then signs in', async () => {
    mocks.status = 'locked'
    mocks.walletInfo = { address: ADDRESS }
    mocks.unlock.mockResolvedValue({ address: ADDRESS })
    mocks.getProvider.mockReturnValue({ request: vi.fn() })
    mocks.signInWithInAppWallet.mockResolvedValue(ADDRESS)
    renderDialog()

    await fillPin()
    await act(async () => {
      fireEvent.click(screen.getByTestId('wallet-unlock'))
    })

    expect(mocks.unlock).toHaveBeenCalledWith('123456')
    expect(mocks.signInWithInAppWallet).toHaveBeenCalled()
  })

  it('shows the error reported by the hook', () => {
    mocks.error = 'Wrong PIN or corrupted wallet data'
    renderDialog()
    expect(screen.getByTestId('wallet-dialog-error')).toHaveTextContent(/Wrong PIN/)
  })

  it('is bilingual', () => {
    renderDialog('es')
    expect(screen.getByRole('dialog').textContent).toContain('Crear una billetera')
    expect(screen.getByTestId('wallet-create')).toHaveTextContent('Crear billetera')
  })
})
