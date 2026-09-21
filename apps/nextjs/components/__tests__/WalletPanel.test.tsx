// @vitest-environment jsdom
import * as React from 'react'
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const USDT = '0x0000000000000000000000000000000000000002'
const SLEARN = '0x0000000000000000000000000000000000000003'
const ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const OTHER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'

const mocks = vi.hoisted(() => ({
  status: 'unlocked' as string,
  getBalance: vi.fn(),
  readContract: vi.fn(),
  sendTransaction: vi.fn(),
  writeContract: vi.fn(),
  writeText: vi.fn(),
  // Identidad ESTABLE: `usePublicClient`/`useWalletClient` reales están memoizados;
  // un cliente nuevo por render haría que el efecto del panel se dispare en bucle.
  publicClient: null as unknown,
  walletClient: null as unknown,
}))

mocks.publicClient = { getBalance: mocks.getBalance, readContract: mocks.readContract }
mocks.walletClient = { sendTransaction: mocks.sendTransaction, writeContract: mocks.writeContract }

vi.mock('@learn-tg/pdj-wallet-next', () => ({
  useInAppWallet: () => ({ status: mocks.status }),
}))

vi.mock('@/lib/hooks/useWallet', () => ({
  usePublicClient: () => mocks.publicClient,
  useWalletClient: () => ({ data: mocks.walletClient }),
}))

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => React.createElement('div', { 'data-testid': 'qr', 'data-value': value }),
}))

import { WalletPanel } from '../WalletPanel'

function renderPanel(props: Partial<React.ComponentProps<typeof WalletPanel>> = {}) {
  return render(
    <WalletPanel lang="en" open address={ADDRESS} onOpenChange={vi.fn()} {...props} />,
  )
}

describe('WalletPanel (R-#249)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.status = 'unlocked'
    process.env.NEXT_PUBLIC_USDT_ADDRESS = USDT
    process.env.NEXT_PUBLIC_SLEARN_ADDRESS = SLEARN
    mocks.getBalance.mockResolvedValue(1_500_000_000_000_000_000n) // 1.5 CELO
    mocks.readContract.mockImplementation(({ address }: { address: string }) =>
      Promise.resolve(address === USDT ? 2_000_000n : 0n),
    )
    mocks.sendTransaction.mockResolvedValue(`0x${'ab'.repeat(32)}`)
    mocks.writeContract.mockResolvedValue(`0x${'cd'.repeat(32)}`)
    mocks.writeText.mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: mocks.writeText },
    })
  })

  it('shows the three balances with their decimals', async () => {
    renderPanel()

    await waitFor(() => {
      expect(screen.getByTestId('wallet-panel-balance-CELO')).toHaveTextContent('1.5')
      expect(screen.getByTestId('wallet-panel-balance-USDT')).toHaveTextContent('2')
      expect(screen.getByTestId('wallet-panel-balance-SLEARN')).toHaveTextContent('0')
    })
    expect(screen.getByTestId('wallet-panel-address')).toHaveTextContent(ADDRESS)
  })

  // R-#249: una lectura caída no puede borrar las otras dos.
  it('keeps the other balances when one read fails', async () => {
    mocks.readContract.mockImplementation(({ address }: { address: string }) =>
      address === USDT ? Promise.reject(new Error('rpc down')) : Promise.resolve(7n),
    )
    renderPanel()

    await waitFor(() => {
      expect(screen.getByTestId('wallet-panel-balance-SLEARN')).toHaveTextContent('0.07')
      expect(screen.getByTestId('wallet-panel-balance-CELO')).toHaveTextContent('1.5')
      expect(screen.getByTestId('wallet-panel-balance-USDT')).toHaveTextContent('—')
    })
  })

  it('copies the checksummed address and confirms it', async () => {
    renderPanel()
    await act(async () => {
      fireEvent.click(screen.getByTestId('wallet-panel-copy'))
    })
    expect(mocks.writeText).toHaveBeenCalledWith(ADDRESS)
    expect(screen.getByTestId('wallet-panel-copy')).toHaveTextContent(/copied/i)
  })

  it('shows a QR code for receiving', async () => {
    renderPanel()
    // R-#254: el QR vive en su pestaña.
    fireEvent.click(screen.getByTestId('wallet-panel-tab-receive'))
    const qr = screen.getByTestId('qr')
    expect(qr).toHaveAttribute('data-value', ADDRESS)
  })

  // R-#254: los coleccionables NO se piden al abrir el panel. La activación de la
  // pestaña no se puede comprobar aquí: `@pasosdejesus/m/test-utils` sustituye los
  // primitivos de Radix por stubs sin estado, así que el cambio de pestaña se cubre
  // en el navegador (`in-app-wallet-payments.spec.mjs`).
  it('does not request the collectibles when the panel opens', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{ metadata: { name: 'SBT #1', image: 'https://example.test/1.png' }, token: { name: 'PdJCredentials' } }],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)
    try {
      renderPanel()
      await waitFor(() => expect(mocks.getBalance).toHaveBeenCalled())
      expect(fetchMock).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('validates the destination, the amount and the balance before sending', async () => {
    renderPanel()
    fireEvent.click(screen.getByTestId('wallet-panel-tab-send'))
    await waitFor(() => expect(screen.getByTestId('wallet-panel-send')).toBeDisabled())

    // Dirección inválida
    fireEvent.change(screen.getByTestId('wallet-panel-to'), { target: { value: 'no-es-direccion' } })
    fireEvent.change(screen.getByTestId('wallet-panel-amount'), { target: { value: '0.1' } })
    await waitFor(() =>
      expect(screen.getByTestId('wallet-panel-error')).toHaveTextContent(/not valid/i),
    )

    // Monto por encima del saldo (1.5 CELO)
    fireEvent.change(screen.getByTestId('wallet-panel-to'), { target: { value: OTHER } })
    fireEvent.change(screen.getByTestId('wallet-panel-amount'), { target: { value: '9' } })
    await waitFor(() =>
      expect(screen.getByTestId('wallet-panel-error')).toHaveTextContent(/CELO for the network fee/i),
    )

    // Dirección propia
    fireEvent.change(screen.getByTestId('wallet-panel-to'), { target: { value: ADDRESS } })
    await waitFor(() =>
      expect(screen.getByTestId('wallet-panel-error')).toHaveTextContent(/this wallet address/i),
    )
  })

  it('sends native CELO through the wallet client', async () => {
    renderPanel()
    fireEvent.click(screen.getByTestId('wallet-panel-tab-send'))
    await waitFor(() => expect(mocks.getBalance).toHaveBeenCalled())

    await act(async () => {
      fireEvent.change(screen.getByTestId('wallet-panel-to'), { target: { value: OTHER } })
      fireEvent.change(screen.getByTestId('wallet-panel-amount'), { target: { value: '0.5' } })
    })
    await waitFor(() => expect(screen.getByTestId('wallet-panel-send')).toBeEnabled())
    await act(async () => {
      fireEvent.click(screen.getByTestId('wallet-panel-send'))
    })

    expect(mocks.sendTransaction).toHaveBeenCalledWith({
      to: OTHER,
      value: 500_000_000_000_000_000n,
    })
    expect(screen.getByTestId('wallet-panel-sent')).toBeInTheDocument()
  })

  it('sends an ERC-20 with its decimals', async () => {
    renderPanel()
    fireEvent.click(screen.getByTestId('wallet-panel-tab-send'))
    await waitFor(() => expect(mocks.readContract).toHaveBeenCalled())

    await act(async () => {
      fireEvent.change(screen.getByTestId('wallet-panel-token'), { target: { value: 'USDT' } })
      fireEvent.change(screen.getByTestId('wallet-panel-to'), { target: { value: OTHER } })
      fireEvent.change(screen.getByTestId('wallet-panel-amount'), { target: { value: '1.5' } })
    })
    await waitFor(() => expect(screen.getByTestId('wallet-panel-send')).toBeEnabled())
    await act(async () => {
      fireEvent.click(screen.getByTestId('wallet-panel-send'))
    })

    expect(mocks.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: USDT,
        functionName: 'transfer',
        args: [OTHER, 1_500_000n],
      }),
    )
  })

  it('does not let a locked wallet send', async () => {
    mocks.status = 'locked'
    renderPanel()
    fireEvent.click(screen.getByTestId('wallet-panel-tab-send'))
    expect(screen.getByTestId('wallet-panel-send')).toBeDisabled()
    expect(screen.getByText(/unlock your in-app wallet to send/i)).toBeInTheDocument()
  })
})
