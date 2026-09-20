import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const walletMock = vi.hoisted(() => ({
  hasWallet: vi.fn(),
  getWalletInfo: vi.fn(),
  createWallet: vi.fn(),
  importWallet: vi.fn(),
  unlockWallet: vi.fn(),
  lockWallet: vi.fn(),
  deleteWallet: vi.fn(),
  getInAppWalletProvider: vi.fn(),
  // Misma regla que el core (R-#251): clave de 8+ caracteres.
  isValidPassword: (value: string) => value.trim().length >= 8,
}))

vi.mock('@learn-tg/pdj-wallet', () => walletMock)

import { InAppWalletSetup } from '../components/InAppWalletSetup'
import { InAppWalletUnlock } from '../components/InAppWalletUnlock'

const ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as `0x${string}`
const INFO = { address: ADDRESS, chain: 'celoSepolia' as const, createdAt: 1 }

describe('InAppWalletSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.indexedDB = {} as IDBFactory
    walletMock.hasWallet.mockResolvedValue(false)
  })

  it('renders the form with the recovery warning', async () => {
    render(<InAppWalletSetup />)
    await waitFor(() => expect(screen.getByTestId('in-app-wallet-setup')).toBeTruthy())
    expect(screen.getByTestId('recovery-warning').textContent).toMatch(/recovery phrase/i)
  })

  it('creates a wallet and shows the recovery phrase', async () => {
    walletMock.createWallet.mockResolvedValue({ walletInfo: INFO, mnemonic: 'alpha beta gamma' })
    const onDone = vi.fn()
    render(<InAppWalletSetup onDone={onDone} />)
    await waitFor(() => expect(screen.getByTestId('in-app-wallet-setup')).toBeTruthy())

    fireEvent.change(screen.getByLabelText('Password (8+ characters)'), { target: { value: '12345678' } })
    fireEvent.change(screen.getByLabelText('Repeat the password'), { target: { value: '12345678' } })
    fireEvent.click(screen.getByTestId('submit'))

    await waitFor(() => expect(screen.getByTestId('recovery-phrase').textContent).toMatch(/alpha beta gamma/))
    expect(walletMock.createWallet).toHaveBeenCalledWith({ password: '12345678' })
    expect(onDone).toHaveBeenCalledWith(ADDRESS)
  })

  it('rejects a password mismatch before calling the core', async () => {
    render(<InAppWalletSetup />)
    await waitFor(() => expect(screen.getByTestId('in-app-wallet-setup')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Password (8+ characters)'), { target: { value: '12345678' } })
    fireEvent.change(screen.getByLabelText('Repeat the password'), { target: { value: '87654321' } })
    fireEvent.click(screen.getByTestId('submit'))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/do not match/i))
    expect(walletMock.createWallet).not.toHaveBeenCalled()
  })

  it('imports an existing mnemonic', async () => {
    walletMock.importWallet.mockResolvedValue(INFO)
    render(<InAppWalletSetup />)
    await waitFor(() => expect(screen.getByTestId('in-app-wallet-setup')).toBeTruthy())
    fireEvent.click(screen.getByTestId('mode-import'))
    fireEvent.change(screen.getByLabelText('Recovery phrase'), {
      target: { value: 'test test test test test test test test test test test junk' },
    })
    fireEvent.change(screen.getByLabelText('Password (8+ characters)'), { target: { value: '12345678' } })
    fireEvent.change(screen.getByLabelText('Repeat the password'), { target: { value: '12345678' } })
    fireEvent.click(screen.getByTestId('submit'))
    await waitFor(() =>
      expect(walletMock.importWallet).toHaveBeenCalledWith({
        password: '12345678',
        mnemonic: 'test test test test test test test test test test test junk',
        privateKey: undefined,
      }),
    )
  })

  it('translates the labels to Spanish', async () => {
    render(<InAppWalletSetup lang="es" />)
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Crear billetera en la aplicación' })).toBeTruthy(),
    )
  })
})

describe('InAppWalletUnlock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.indexedDB = {} as IDBFactory
    walletMock.hasWallet.mockResolvedValue(true)
    walletMock.getWalletInfo.mockResolvedValue(INFO)
  })

  it('unlocks with the right password', async () => {
    walletMock.unlockWallet.mockResolvedValue(INFO)
    const onUnlocked = vi.fn()
    render(<InAppWalletUnlock onUnlocked={onUnlocked} />)
    fireEvent.change(screen.getByLabelText('Password (8+ characters)'), { target: { value: '12345678' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
    await waitFor(() => expect(onUnlocked).toHaveBeenCalledWith(ADDRESS))
    expect(walletMock.unlockWallet).toHaveBeenCalledWith('12345678')
  })

  it('shows an error with the wrong password', async () => {
    walletMock.unlockWallet.mockRejectedValue(new Error('Wrong password or corrupted wallet data'))
    render(<InAppWalletUnlock />)
    fireEvent.change(screen.getByLabelText('Password (8+ characters)'), { target: { value: '00000000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/wrong password/i))
  })
})
