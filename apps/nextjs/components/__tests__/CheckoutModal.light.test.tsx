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
vi.mock('@learn-tg/pdj-wallet-next', () => ({
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
  useContractPayment: () => ({ state: 'idle', error: null, execute: vi.fn() }),
}))

describe('CheckoutModal (light)', () => {
  beforeEach(() => {
    ;(process as any).env.NEXT_PUBLIC_ADDRESS = '0xBACKEND123456789012345678901234567890123456'
    ;(process as any).env.NEXT_PUBLIC_SLEARN_ADDRESS =
      '0xSLEARN123456789012345678901234567890123456'
    ;(process as any).env.NEXT_PUBLIC_USDT_ADDRESS =
      '0x0000000000000000000000000000000000000002'
    ;(process as any).env.NEXT_PUBLIC_USDT_DECIMALS = '6'
    h.walletClient = { data: { writeContract: vi.fn().mockResolvedValue('0xhash') } }
    h.inAppStatus = 'no-wallet'
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
})
