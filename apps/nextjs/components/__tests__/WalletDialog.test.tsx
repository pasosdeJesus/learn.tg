// @vitest-environment jsdom
import * as React from 'react'
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { beforeEach, describe, it, expect, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  status: 'no-wallet' as string,
  walletInfo: null as { address: string } | null,
  error: null as string | null,
  create: vi.fn(),
  importExisting: vi.fn(),
  unlock: vi.fn(),
  unlockWithBiometric: vi.fn(),
  enableBiometric: vi.fn(),
  disableBiometric: vi.fn(),
  biometricAvailable: false,
  biometricEnabled: false,
  remove: vi.fn(),
  getProvider: vi.fn(),
  signInWithInAppWallet: vi.fn(),
  reload: vi.fn(),
}))

vi.mock('@learn-tg/pdj-wallet-next', () => ({
  // Misma regla que el paquete (R-#251): clave de 8+ caracteres.
  isValidPassword: (value: string) => value.trim().length >= 8,
  useInAppWallet: () => ({
    status: mocks.status,
    walletInfo: mocks.walletInfo,
    error: mocks.error,
    create: mocks.create,
    importExisting: mocks.importExisting,
    unlock: mocks.unlock,
    unlockWithBiometric: mocks.unlockWithBiometric,
    enableBiometric: mocks.enableBiometric,
    disableBiometric: mocks.disableBiometric,
    biometricAvailable: mocks.biometricAvailable,
    biometricEnabled: mocks.biometricEnabled,
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

function renderDialog(lang = 'en', sessionAddress?: string) {
  return render(<WalletDialog lang={lang} open onOpenChange={vi.fn()} sessionAddress={sessionAddress} />)
}

/**
 * Lee la frase de la pantalla, confirma que se anotó y responde las tres palabras
 * que pide la verificación (R-#249). Devuelve las posiciones usadas.
 */
function wordByPosition(): Map<number, string> {
  const map = new Map<number, string>()
  const list = screen.getByTestId('wallet-recovery-words')
  list.querySelectorAll('li').forEach((li) => {
    const spans = li.querySelectorAll('span')
    map.set(Number((spans[0]?.textContent || '').replace(/[^0-9]/g, '')), (spans[1]?.textContent || '').trim())
  })
  return map
}

async function completeBackup({ wrongInsteadOfCorrect = false } = {}) {
  const words = wordByPosition()
  await act(async () => {
    fireEvent.click(screen.getByTestId('wallet-words-done'))
  })
  // Sólo las posiciones que el diálogo pide (tres), no las doce de la lista.
  const asked = [...document.querySelectorAll('[data-testid^="wallet-verify-"]')]
    .map((el) => Number((el.getAttribute('data-testid') || '').replace('wallet-verify-', '')))
    .filter((position) => Number.isFinite(position))
    .sort((a, b) => a - b)

  asked.forEach((position, index) => {
    const input = screen.queryByTestId(`wallet-verify-${position}`)
    if (!input) return
    const value = wrongInsteadOfCorrect && index === 0 ? 'nottheword' : words.get(position) || ''
    fireEvent.change(input, { target: { value } })
  })
  await act(async () => {
    fireEvent.click(screen.getByTestId('wallet-verify'))
  })
  return asked
}

async function fillPassword(password = '12345678') {
  fireEvent.change(screen.getByTestId('wallet-password'), { target: { value: password } })
  if (screen.queryByTestId('wallet-password-confirm')) {
    fireEvent.change(screen.getByTestId('wallet-password-confirm'), { target: { value: password } })
  }
}

describe('WalletDialog (R-#244)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mocks.status = 'no-wallet'
    mocks.walletInfo = null
    mocks.error = null
    mocks.biometricAvailable = false
    mocks.biometricEnabled = false
  })

  it('creates the wallet and shows the 12 words with a confirmation', async () => {
    mocks.create.mockResolvedValue({
      walletInfo: { address: ADDRESS },
      mnemonic: 'one two three four five six seven eight nine ten eleven twelve',
    })
    renderDialog()

    await fillPassword()
    await act(async () => {
      fireEvent.click(screen.getByTestId('wallet-create'))
    })

    expect(mocks.create).toHaveBeenCalledWith('12345678')
    const words = screen.getByTestId('wallet-recovery-words')
    expect(words.querySelectorAll('li')).toHaveLength(12)
    // Todavía no firma: primero se respaldan las palabras y se verifica (R-#249)
    expect(mocks.signInWithInAppWallet).not.toHaveBeenCalled()
    expect(screen.getByTestId('wallet-words-done')).toBeInTheDocument()
    expect(screen.queryByTestId('wallet-verify')).not.toBeInTheDocument()
  })

  it('does not create the wallet when the PINs differ', async () => {
    renderDialog()
    fireEvent.change(screen.getByTestId('wallet-password'), { target: { value: '12345678' } })
    fireEvent.change(screen.getByTestId('wallet-password-confirm'), { target: { value: '87654321' } })
    await act(async () => {
      fireEvent.click(screen.getByTestId('wallet-create'))
    })
    expect(mocks.create).not.toHaveBeenCalled()
    expect(screen.getByTestId('wallet-dialog-error')).toHaveTextContent(/do not match/i)
  })

  it('rejects a password shorter than eight characters', async () => {
    renderDialog()
    await fillPassword('123')
    await act(async () => {
      fireEvent.click(screen.getByTestId('wallet-create'))
    })
    expect(mocks.create).not.toHaveBeenCalled()
    expect(screen.getByTestId('wallet-dialog-error')).toHaveTextContent(/8 characters/i)
  })

  it('asks for three words and signs in only when they match', async () => {
    mocks.create.mockResolvedValue({
      walletInfo: { address: ADDRESS },
      mnemonic: 'one two three four five six seven eight nine ten eleven twelve',
    })
    mocks.getProvider.mockReturnValue({ request: vi.fn() })
    mocks.signInWithInAppWallet.mockResolvedValue(ADDRESS)
    renderDialog()

    await fillPassword()
    await act(async () => {
      fireEvent.click(screen.getByTestId('wallet-create'))
    })

    const positions = await completeBackup()
    expect(positions).toHaveLength(3)
    expect(mocks.signInWithInAppWallet).toHaveBeenCalled()
    expect(mocks.reload).toHaveBeenCalled()
    expect(localStorage.getItem('learn.tg.wallet.backupConfirmed')).toBe('1')
  })

  // R-#254: en un dispositivo que puede verificar al usuario, la creación ofrece
  // la huella y la engancha al confirmar el respaldo, con la clave todavía en
  // memoria (no se vuelve a pedir).
  it('enrolls the fingerprint during creation when the device supports it', async () => {
    mocks.biometricAvailable = true
    mocks.create.mockResolvedValue({
      walletInfo: { address: ADDRESS },
      mnemonic: 'one two three four five six seven eight nine ten eleven twelve',
    })
    mocks.enableBiometric.mockResolvedValue(undefined)
    mocks.getProvider.mockReturnValue({ request: vi.fn() })
    mocks.signInWithInAppWallet.mockResolvedValue(ADDRESS)
    renderDialog()

    await fillPassword()
    await act(async () => {
      fireEvent.click(screen.getByTestId('wallet-create'))
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('wallet-words-done'))
    })
    expect(screen.getByTestId('wallet-create-biometric')).toBeChecked()

    // Volver a mostrar la frase: `completeBackup` la lee para responder.
    await act(async () => {
      fireEvent.click(screen.getByTestId('wallet-words-peek'))
    })
    await completeBackup()

    expect(mocks.enableBiometric).toHaveBeenCalledWith('12345678')
    expect(mocks.signInWithInAppWallet).toHaveBeenCalled()
  })

  it('keeps the password-only path when the device cannot verify the user', async () => {
    mocks.biometricAvailable = false
    mocks.create.mockResolvedValue({
      walletInfo: { address: ADDRESS },
      mnemonic: 'one two three four five six seven eight nine ten eleven twelve',
    })
    mocks.getProvider.mockReturnValue({ request: vi.fn() })
    mocks.signInWithInAppWallet.mockResolvedValue(ADDRESS)
    renderDialog()

    await fillPassword()
    await act(async () => {
      fireEvent.click(screen.getByTestId('wallet-create'))
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('wallet-words-done'))
    })

    expect(screen.queryByTestId('wallet-create-biometric')).not.toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByTestId('wallet-words-peek'))
    })
    await completeBackup()
    expect(mocks.enableBiometric).not.toHaveBeenCalled()
    expect(mocks.signInWithInAppWallet).toHaveBeenCalled()
  })

  it('still signs in when the fingerprint gesture is cancelled during creation', async () => {
    mocks.biometricAvailable = true
    mocks.create.mockResolvedValue({
      walletInfo: { address: ADDRESS },
      mnemonic: 'one two three four five six seven eight nine ten eleven twelve',
    })
    mocks.enableBiometric.mockRejectedValue(new Error('NotAllowedError'))
    mocks.getProvider.mockReturnValue({ request: vi.fn() })
    mocks.signInWithInAppWallet.mockResolvedValue(ADDRESS)
    renderDialog()

    await fillPassword()
    await act(async () => {
      fireEvent.click(screen.getByTestId('wallet-create'))
    })
    await completeBackup()

    expect(mocks.enableBiometric).toHaveBeenCalled()
    expect(mocks.signInWithInAppWallet).toHaveBeenCalled()
  })

  // El respaldo no se da por hecho: con una palabra equivocada no se firma y se
  // puede volver a ver la frase.
  it('does not sign in when a backup word is wrong', async () => {
    mocks.create.mockResolvedValue({
      walletInfo: { address: ADDRESS },
      mnemonic: 'one two three four five six seven eight nine ten eleven twelve',
    })
    mocks.getProvider.mockReturnValue({ request: vi.fn() })
    mocks.signInWithInAppWallet.mockResolvedValue(ADDRESS)
    renderDialog()

    await fillPassword()
    await act(async () => {
      fireEvent.click(screen.getByTestId('wallet-create'))
    })

    await completeBackup({ wrongInsteadOfCorrect: true })

    expect(mocks.signInWithInAppWallet).not.toHaveBeenCalled()
    expect(screen.getByTestId('wallet-verify-error')).toHaveTextContent(/do not match/i)
    expect(localStorage.getItem('learn.tg.wallet.backupConfirmed')).not.toBe('1')

    // Y puede volver a ver la frase si no la recuerda.
    await act(async () => {
      fireEvent.click(screen.getByTestId('wallet-words-peek'))
    })
    expect(screen.getByTestId('wallet-recovery-words')).toBeInTheDocument()
  })

  it('unlocks an existing wallet and then signs in', async () => {
    mocks.status = 'locked'
    mocks.walletInfo = { address: ADDRESS }
    mocks.unlock.mockResolvedValue({ address: ADDRESS })
    mocks.getProvider.mockReturnValue({ request: vi.fn() })
    mocks.signInWithInAppWallet.mockResolvedValue(ADDRESS)
    renderDialog()

    await fillPassword()
    await act(async () => {
      fireEvent.click(screen.getByTestId('wallet-unlock'))
    })

    expect(mocks.unlock).toHaveBeenCalledWith('12345678')
    expect(mocks.signInWithInAppWallet).toHaveBeenCalled()
  })

  // R-#246 (L2): con la passkey registrada el gesto es el camino principal: al
  // abrir el diálogo bloqueado se pide directamente, sin campo de password.
  it('asks for the gesture as soon as the locked dialog opens', async () => {
    mocks.status = 'locked'
    mocks.walletInfo = { address: ADDRESS }
    mocks.biometricEnabled = true
    mocks.unlockWithBiometric.mockResolvedValue({ address: ADDRESS })
    mocks.getProvider.mockReturnValue({ request: vi.fn() })
    mocks.signInWithInAppWallet.mockResolvedValue(ADDRESS)
    renderDialog()

    expect(screen.queryByTestId('wallet-password')).not.toBeInTheDocument()

    await waitFor(() => expect(mocks.unlockWithBiometric).toHaveBeenCalled())
    expect(mocks.unlock).not.toHaveBeenCalled()
    expect(mocks.signInWithInAppWallet).toHaveBeenCalled()
  })

  // R-#246: el gesto no es el único camino. Si se cancela, el password queda a un
  // toque de distancia y no se pierde la billetera.
  it('falls back to the password when the gesture is cancelled', async () => {
    mocks.status = 'locked'
    mocks.walletInfo = { address: ADDRESS }
    mocks.biometricEnabled = true
    mocks.unlockWithBiometric.mockRejectedValue(new Error('NotAllowedError'))
    mocks.unlock.mockResolvedValue({ address: ADDRESS })
    mocks.getProvider.mockReturnValue({ request: vi.fn() })
    mocks.signInWithInAppWallet.mockResolvedValue(ADDRESS)
    renderDialog()

    await waitFor(() => {
      expect(screen.getByTestId('wallet-dialog-error')).toHaveTextContent(/cancelled/i)
    })
    expect(screen.getByTestId('wallet-password')).toBeInTheDocument()

    await fillPassword()
    await act(async () => {
      fireEvent.click(screen.getByTestId('wallet-unlock'))
    })

    expect(mocks.unlock).toHaveBeenCalledWith('12345678')
    expect(mocks.signInWithInAppWallet).toHaveBeenCalled()
  })

  it('offers to enable the fingerprint with the same password', async () => {
    mocks.status = 'locked'
    mocks.walletInfo = { address: ADDRESS }
    mocks.biometricAvailable = true
    mocks.enableBiometric.mockResolvedValue({ address: ADDRESS })
    mocks.getProvider.mockReturnValue({ request: vi.fn() })
    mocks.signInWithInAppWallet.mockResolvedValue(ADDRESS)
    renderDialog()

    // Deshabilitado hasta que haya password
    expect(screen.getByTestId('wallet-enable-biometric')).toBeDisabled()
    await fillPassword()
    await act(async () => {
      fireEvent.click(screen.getByTestId('wallet-enable-biometric'))
    })

    expect(mocks.enableBiometric).toHaveBeenCalledWith('12345678')
    expect(mocks.signInWithInAppWallet).toHaveBeenCalled()
  })

  it('does not offer the fingerprint when the device cannot verify the user', () => {
    mocks.status = 'locked'
    mocks.walletInfo = { address: ADDRESS }
    mocks.biometricAvailable = false
    renderDialog()

    expect(screen.queryByTestId('wallet-enable-biometric')).not.toBeInTheDocument()
    expect(screen.queryByTestId('wallet-unlock-biometric')).not.toBeInTheDocument()
    expect(screen.getByTestId('wallet-unlock')).toBeInTheDocument()
  })

  it('lets the user turn the fingerprint unlock off', async () => {
    mocks.status = 'unlocked'
    mocks.walletInfo = { address: ADDRESS }
    mocks.biometricEnabled = true
    mocks.disableBiometric.mockResolvedValue(undefined)
    renderDialog()

    expect(screen.getByTestId('wallet-biometric-status')).toHaveTextContent(/fingerprint unlock is on/i)
    await act(async () => {
      fireEvent.click(screen.getByTestId('wallet-disable-biometric'))
    })
    expect(mocks.disableBiometric).toHaveBeenCalled()
  })

  it('reports a cancelled gesture without losing the wallet', async () => {
    mocks.status = 'locked'
    mocks.walletInfo = { address: ADDRESS }
    mocks.biometricEnabled = true
    mocks.unlockWithBiometric.mockRejectedValue(new Error('NotAllowedError'))
    renderDialog()

    await waitFor(() => {
      expect(screen.getByTestId('wallet-dialog-error')).toHaveTextContent(/cancelled/i)
    })
    expect(screen.getByTestId('wallet-unlock-biometric')).toBeInTheDocument()
  })

  // R-#244: si la cookie de sesión ya es de esta billetera, volver a firmar el
  // SIWE recarga la página, la clave sale de memoria y la billetera queda
  // bloqueada otra vez: el usuario no llegaba a donar ni a comprar
  // (reportado el 2026-09-16).
  it('does not sign in again when the session already is this wallet', async () => {
    mocks.status = 'locked'
    mocks.walletInfo = { address: ADDRESS }
    mocks.unlock.mockResolvedValue({ address: ADDRESS })
    mocks.getProvider.mockReturnValue({ request: vi.fn() })
    mocks.signInWithInAppWallet.mockResolvedValue(ADDRESS)
    renderDialog('en', ADDRESS.toLowerCase())

    await fillPassword()
    await act(async () => {
      fireEvent.click(screen.getByTestId('wallet-unlock'))
    })

    expect(mocks.unlock).toHaveBeenCalledWith('12345678')
    expect(mocks.signInWithInAppWallet).not.toHaveBeenCalled()
    expect(mocks.reload).not.toHaveBeenCalled()
  })

  it('shows the error reported by the hook', () => {
    mocks.error = 'Wrong password or corrupted wallet data'
    renderDialog()
    expect(screen.getByTestId('wallet-dialog-error')).toHaveTextContent(/Wrong password/)
  })

  // R-#251: la frase de recuperación se valida (BIP39) antes de derivar; el código
  // `invalid-mnemonic` no es texto para el usuario.
  it('translates an invalid recovery phrase when importing', async () => {
    mocks.status = 'no-wallet'
    mocks.importExisting.mockRejectedValue(new Error('invalid-mnemonic'))
    renderDialog()

    fireEvent.click(screen.getByTestId('wallet-mode-import'))
    fireEvent.change(screen.getByTestId('wallet-mnemonic'), {
      target: { value: 'test test test test test test test test test test test tset' },
    })
    await fillPassword()
    await act(async () => {
      fireEvent.click(screen.getByTestId('wallet-import'))
    })

    expect(screen.getByTestId('wallet-dialog-error')).toHaveTextContent(/not valid/i)
    expect(mocks.importExisting).toHaveBeenCalled()
  })

  // Bug E (2026-09-19): con la billetera desbloqueada el diálogo mostraba el
  // formulario de crear/importar; el operador esperaba ver SU billetera.
  it('shows the wallet, not the create form, when it is unlocked', () => {
    mocks.status = 'unlocked'
    mocks.walletInfo = { address: ADDRESS }
    mocks.biometricEnabled = true
    renderDialog()

    expect(screen.getByTestId('wallet-address')).toBeInTheDocument()
    expect(screen.getByTestId('wallet-biometric-status')).toBeInTheDocument()
    expect(screen.queryByTestId('wallet-create')).not.toBeInTheDocument()
    expect(screen.queryByTestId('wallet-password-confirm')).not.toBeInTheDocument()
    expect(screen.queryByTestId('wallet-mode-create')).not.toBeInTheDocument()
  })

  it('is bilingual', () => {
    renderDialog('es')
    expect(screen.getByRole('dialog').textContent).toContain('Crear una billetera')
    expect(screen.getByTestId('wallet-create')).toHaveTextContent('Crear billetera')
  })

  // R-#238: el modal reabría en la pantalla de la frase de recuperación (el
  // operador lo reportó el 2026-09-15) y parecía imposible desbloquear la
  // billetera recién creada. Al cerrar, el flujo vuelve a empezar.
  it('starts a fresh flow when it is closed and reopened', async () => {
    mocks.create.mockResolvedValue({
      walletInfo: { address: ADDRESS },
      mnemonic: 'one two three four five six seven eight nine ten eleven twelve',
    })
    const onOpenChange = vi.fn()
    const { rerender } = render(<WalletDialog lang="en" open onOpenChange={onOpenChange} />)

    await fillPassword()
    await act(async () => {
      fireEvent.click(screen.getByTestId('wallet-create'))
    })
    expect(screen.getByTestId('wallet-recovery-words')).toBeInTheDocument()

    rerender(<WalletDialog lang="en" open={false} onOpenChange={onOpenChange} />)
    rerender(<WalletDialog lang="en" open onOpenChange={onOpenChange} />)

    expect(screen.queryByTestId('wallet-recovery-words')).not.toBeInTheDocument()
    expect(screen.getByTestId('wallet-password')).toBeInTheDocument()
  })
})
