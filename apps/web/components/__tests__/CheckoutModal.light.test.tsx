import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CheckoutModal } from '../CheckoutModal'

// El barrel @pasosdejesus/m/debug (DebugConsole.js) crashea el worker de Node en
// OpenBSD (Check failed: result.ptr != nullptr); los hooks lo usan solo para loguear.
vi.mock('@pasosdejesus/m/debug', () => ({
  logger: { info: vi.fn(), error: vi.fn(), success: vi.fn(), warning: vi.fn(), debug: vi.fn() },
}))

vi.mock('@learn-tg/rewards/lib/deployments', () => ({
  getV3Address: vi.fn().mockReturnValue('0xVAULT12345678901234567890123456789012345678'),
  getSlearnAddress: vi.fn().mockReturnValue('0xSLEARN123456789012345678901234567890123456'),
  getV2Address: vi.fn().mockReturnValue('0xV212345678901234567890123456789012345678'),
}))

// Las direcciones de USDT/SLEARN salen de `mpdj` (por red); se fijan aquí.
vi.mock('@pasosdejesus/mpdj/blockchain/ecosystem-addresses', () => ({
  resolveNetwork: () => 'celoSepolia',
  USDT_ADDRESSES: { celo: '0x0000000000000000000000000000000000000002', celoSepolia: '0x0000000000000000000000000000000000000002' },
  SLEARN_ADDRESSES: { celo: '0xSLEARN123456789012345678901234567890123456', celoSepolia: '0xSLEARN123456789012345678901234567890123456' },
}))

vi.mock('@pasosdejesus/m/shadcn-components/ui/button', () => ({
  Button: React.forwardRef(({ children, onClick, disabled, ...props }: any, ref: any) => (
    <button ref={ref} onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  )),
}))

vi.mock('@pasosdejesus/m/shadcn-components/ui/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

const h = vi.hoisted(() => ({
  walletClient: { data: { writeContract: vi.fn().mockResolvedValue('0xhash') } } as any,
  inAppStatus: 'no-wallet' as string,
  payment: {
    state: 'idle',
    error: null as string | null,
    execute: vi.fn(),
    reset: vi.fn(),
  },
}))

vi.mock('@/lib/hooks/useAuthAddress', () => ({
  useAuthAddress: () => ({ address: '0xabc0000000000000000000000000000000000000' }),
}))

const publicClientMock = {
  readContract: vi.fn().mockImplementation((opts: any) =>
    opts.functionName === 'decimals' ? Promise.resolve(6) : Promise.resolve(1_000_000_000n),
  ),
  getBalance: vi.fn().mockResolvedValue(10_000_000_000_000_000n), // 0.01 CELO
  getGasPrice: vi.fn().mockResolvedValue(1n),
  estimateContractGas: vi.fn().mockResolvedValue(21_000n),
  waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: 'success' }),
}

// Mocks ESTABLES: devolver objetos nuevos por render rompe las deps de los
// efectos (bucle de renders hasta OOM).
vi.mock('@/lib/hooks/useWallet', () => ({
  usePublicClient: () => publicClientMock,
  useWalletClient: () => h.walletClient,
}))

// R-#244: el modal consulta el estado de la billetera de la aplicación.
vi.mock('@pasosdejesus/m/wallet/next', () => ({
  useInAppWallet: () => ({ status: h.inAppStatus }),
}))

vi.mock('@/lib/hooks/useAuthedApi', () => ({
  useAuthedApi: () => ({
    authedGet: vi.fn().mockResolvedValue({ data: { priceUSDT: 5, priceSLEARN: 45 } }),
    authedPost: vi.fn().mockResolvedValue({ data: {} }),
  }),
}))

vi.mock('@/lib/hooks/useGasEstimation', () => ({
  useGasEstimation: () => ({ gasState: 'ok', estimating: false, diag: {} }),
}))

vi.mock('@/lib/hooks/useContractPayment', () => ({
  useContractPayment: () => h.payment,
}))

// Sin billetera real en el entorno de prueba el pre-flight de red no puede cambiar de
// cadena; se simula que ya estamos en Celo para poder observar el reintento completo.
vi.mock('@/lib/ensure-chain', () => ({
  ensureWalletChain: vi.fn().mockResolvedValue(undefined),
  WrongChainError: class WrongChainError extends Error {
    isInApp = false
  },
}))

describe('CheckoutModal (light)', () => {
  beforeEach(() => {
    ;(process as any).env.NEXT_PUBLIC_ADDRESS = '0xBACKEND123456789012345678901234567890123456'
    ;(process as any).env.NEXT_PUBLIC_SLEARN_TESTNET =
      '0xSLEARN123456789012345678901234567890123456'
    ;(process as any).env.NEXT_PUBLIC_USDT_TESTNET =
      '0x0000000000000000000000000000000000000002'
    ;(process as any).env.NEXT_PUBLIC_USDT_DECIMALS = '6'
    h.walletClient = { data: { writeContract: vi.fn().mockResolvedValue('0xhash') } }
    h.inAppStatus = 'no-wallet'
    h.payment = { state: 'idle', error: null, execute: vi.fn(), reset: vi.fn() }
  })

  function renderModal() {
    return render(
      <CheckoutModal courseId={1} lang="en" isOpen={true} onClose={() => {}} onSuccess={() => {}} />,
    )
  }

  it('renderiza el título de compra', async () => {
    renderModal()
    expect(await screen.findByText(/Purchase course/i)).toBeInTheDocument()
  })

  // R-#244: sin desbloquear la billetera in-app no hay wallet client y el botón
  // de compra nunca se habilita; antes no se explicaba nada al usuario.
  it('pide desbloquear la billetera in-app cuando está bloqueada', async () => {
    h.walletClient = { data: undefined }
    h.inAppStatus = 'locked'
    renderModal()

    expect(await screen.findByText(/in-app wallet is locked/i)).toBeInTheDocument()
    expect(screen.queryByText(/Connect and sign with your wallet/i)).not.toBeInTheDocument()

    const opened = vi.fn()
    window.addEventListener('learn-tg:open-in-app-wallet-dialog', opened)
    fireEvent.click(screen.getByTestId('wallet-unlock-request'))
    expect(opened).toHaveBeenCalled()
    window.removeEventListener('learn-tg:open-in-app-wallet-dialog', opened)
  })

  it('no muestra el aviso si la billetera in-app no está bloqueada', async () => {
    renderModal()
    await waitFor(() => expect(screen.getByText(/Purchase course/i)).toBeInTheDocument())
    expect(screen.queryByTestId('wallet-unlock-request')).not.toBeInTheDocument()
  })

  it('no renderiza nada cuando está cerrado', () => {
    render(
      <CheckoutModal courseId={1} lang="en" isOpen={false} onClose={() => {}} />,
    )
    expect(screen.queryByText(/Purchase course/i)).not.toBeInTheDocument()
  })

  // El modal se monta cerrado y sólo después se abre. Un hook declarado después del
  // `if (!isOpen) return null` cambia el número de hooks entre esos dos renders y React
  // lanza "Rendered more hooks than during the previous render": el pre-flight de red
  // (`handlePay`) tuvo que subir arriba por eso.
  it('se abre cuando el padre lo monta cerrado y luego lo abre', async () => {
    const { rerender } = render(
      <CheckoutModal courseId={1} lang="en" isOpen={false} onClose={() => {}} />,
    )
    rerender(
      <CheckoutModal courseId={1} lang="en" isOpen={true} onClose={() => {}} onSuccess={() => {}} />,
    )
    expect(await screen.findByText(/Purchase course/i)).toBeInTheDocument()
  })

  // Reporte del operador (2026-10-28): tras un error, al reintentar la compra el mensaje
  // anterior seguía en pantalla ("pensé que había vuelto a fallar"). `handlePay` llama al
  // `reset()` del hook antes de ejecutar.
  it('limpia el error anterior al reintentar la compra', async () => {
    h.payment = {
      state: 'error',
      error: 'Insufficient funds for gas',
      execute: vi.fn(),
      reset: vi.fn(),
    }
    renderModal()

    const purchase = await screen.findByRole('button', { name: /^Purchase$/i })
    await waitFor(() => expect(purchase).toBeEnabled())
    expect(screen.getByTestId('checkout-error')).toHaveTextContent(/Insufficient funds/i)

    fireEvent.click(purchase)

    expect(h.payment.reset).toHaveBeenCalled()
    await waitFor(() => expect(h.payment.execute).toHaveBeenCalled())
  })

  // El error de viem "An unknown RPC error occurred ... Failed to fetch" no dice qué hacer
  // (compra desde una cuenta nueva, 2026-10-28): se añade una explicación en el idioma del
  // estudiante y se conserva el detalle técnico para copiar.
  it('explica un fallo de red/RPC y conserva el detalle técnico', async () => {
    h.payment = {
      state: 'error',
      error: 'An unknown RPC error occurred.\n\nDetails: Failed to fetch',
      execute: vi.fn(),
      reset: vi.fn(),
    }
    renderModal()

    const hint = await screen.findByTestId('checkout-network-error')
    expect(hint).toHaveTextContent(/reach the network node/i)
    expect(screen.getByTestId('checkout-error')).toHaveTextContent(/Failed to fetch/i)
  })

  it('no muestra la explicación de red para un rechazo de la billetera', async () => {
    h.payment = {
      state: 'error',
      error: 'User rejected the request.',
      execute: vi.fn(),
      reset: vi.fn(),
    }
    renderModal()

    expect(await screen.findByTestId('checkout-error')).toHaveTextContent(/User rejected/i)
    expect(screen.queryByTestId('checkout-network-error')).not.toBeInTheDocument()
  })

  // "Se demoró mucho": el botón decía "Procesando…" pero no qué estaba esperando.
  it('explica qué se está esperando mientras paga y mientras la red confirma', async () => {
    h.payment = { state: 'paying', error: null, execute: vi.fn(), reset: vi.fn() }
    const { unmount } = renderModal()
    expect(await screen.findByTestId('checkout-busy')).toHaveTextContent(/Confirm the payment in your wallet/i)
    unmount()

    h.payment = { state: 'confirming', error: null, execute: vi.fn(), reset: vi.fn() }
    renderModal()
    expect(await screen.findByTestId('checkout-busy')).toHaveTextContent(/Waiting for the network/i)
  })
})
