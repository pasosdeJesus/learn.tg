import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DonateModal from '../DonateModal'

// Mocks mínimos de wagmi para no cargar lógica real
const readContractMock = vi.fn().mockImplementation((opts: any) => {
  switch (opts.functionName) {
    case 'decimals':
      return Promise.resolve(6)
    case 'balanceOf':
      return Promise.resolve(1_000_000_000n) // 1000 USDT con 6 dec
    case 'allowance':
      return Promise.resolve(0n)
    default:
      return Promise.resolve(0n)
  }
})
vi.mock('wagmi', () => ({
  useAccount: () => ({ address: '0xabc0000000000000000000000000000000000000' }),
  usePublicClient: () => ({
    readContract: readContractMock,
    getBalance: vi.fn().mockResolvedValue(10_000_000_000_000_000n), // 0.01 CELO
    getGasPrice: vi.fn().mockResolvedValue(1n),
    estimateContractGas: vi.fn().mockResolvedValue(21_000n),
    waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: 'success' }),
  }),
  useWalletClient: () => ({
    data: { writeContract: vi.fn().mockResolvedValue('0xhash') },
  }),
}))

describe('DonateModal (light)', () => {
  beforeEach(() => {
    // Variables de entorno mínimas
    ;(process as any).env.NEXT_PUBLIC_DEPLOYED_AT =
      '0x0000000000000000000000000000000000000001'
    ;(process as any).env.NEXT_PUBLIC_USDT_ADDRESS =
      '0x0000000000000000000000000000000000000002'
    ;(process as any).env.NEXT_PUBLIC_USDT_DECIMALS = '6'
  })

  function renderModal() {
    return render(
      <DonateModal
        courseId={1}
        isOpen={true}
        onClose={() => {}}
        onSuccess={() => {}}
        lang="en"
      />,
    )
  }

  it('renderiza encabezado y campo de monto', async () => {
    await waitFor(() => {
      renderModal()
      expect(screen.getByText(/Donate to course/i)).toBeInTheDocument()
    })
    const input = await screen.findByLabelText(/Amount \(USDT\)/i)
    expect(input).toBeInTheDocument()
  })

  it('deshabilita botón donate sin monto', () => {
    renderModal()
    const btn = screen.getByRole('button', { name: /Approve & Donate|Donate/i })
    expect(btn).toBeDisabled()
  })

  it('habilita flujo básico tras ingresar monto válido (mock ok)', async () => {
    renderModal()
    const input = await screen.findByLabelText(/Amount \(USDT\)/i)
    fireEvent.change(input, { target: { value: '1' } })
    await waitFor(() => {
      const btn = screen.getByRole('button', {
        name: /Approve & Donate|Donate/i,
      })
      expect(btn).not.toBeDisabled()
    })
  })
})
