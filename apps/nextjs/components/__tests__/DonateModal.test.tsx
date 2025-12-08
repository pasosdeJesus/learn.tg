import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import DonateModal, { parseUserAmount } from '../DonateModal'

// Mock @/components/ui/button
vi.mock('@/components/ui/button', () => ({
  Button: React.forwardRef(({ children, onClick, disabled, variant, size, className, ...props }: any, ref: any) => (
    <button
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      data-testid={`button-${variant}-${size}`}
      className={className}
      {...props}
    >
      {children}
    </button>
  )),
}))

// Mock @/abis/LearnTGVaults.json
vi.mock('@/abis/LearnTGVaults.json', () => ({
  default: [],
}))

// Mock wagmi hooks
const mockReadContract = vi.fn()
const mockGetBalance = vi.fn()
const mockGetGasPrice = vi.fn()
const mockEstimateContractGas = vi.fn()
const mockWaitForTransactionReceipt = vi.fn()
const mockWriteContract = vi.fn()

const mockUseAccount = vi.fn()
const mockUsePublicClient = vi.fn()
const mockUseWalletClient = vi.fn()

vi.mock('wagmi', () => ({
  useAccount: () => mockUseAccount(),
  usePublicClient: () => mockUsePublicClient(),
  useWalletClient: () => mockUseWalletClient(),
}))

describe('DonateModal', () => {
  const defaultEnv = {
    NEXT_PUBLIC_DEPLOYED_AT: '0x0000000000000000000000000000000000000001',
    NEXT_PUBLIC_USDT_ADDRESS: '0x0000000000000000000000000000000000000002',
    NEXT_PUBLIC_USDT_DECIMALS: '6',
  }

  const defaultAddress = '0xabc0000000000000000000000000000000000000'
  const defaultCourseId = 1
  const defaultOnClose = vi.fn()
  const defaultOnSuccess = vi.fn()

  beforeEach(() => {
    // Set environment variables
    Object.keys(defaultEnv).forEach(key => {
      ;(process.env as any)[key] = (defaultEnv as any)[key]
    })

    // Default wagmi mocks
    mockUseAccount.mockReturnValue({ address: defaultAddress })
    mockUsePublicClient.mockReturnValue({
      readContract: mockReadContract,
      getBalance: mockGetBalance,
      getGasPrice: mockGetGasPrice,
      estimateContractGas: mockEstimateContractGas,
      waitForTransactionReceipt: mockWaitForTransactionReceipt,
    })
    mockUseWalletClient.mockReturnValue({
      data: { writeContract: mockWriteContract },
    })

    // Default contract responses
    mockReadContract.mockImplementation((opts: any) => {
      switch (opts.functionName) {
        case 'decimals':
          return Promise.resolve(6n)
        case 'balanceOf':
          return Promise.resolve(1_000_000_000n) // 1000 USDT with 6 decimals
        case 'allowance':
          return Promise.resolve(0n)
        default:
          return Promise.resolve(0n)
      }
    })
    mockGetBalance.mockResolvedValue(10_000_000_000_000_000n) // 0.01 CELO
    mockGetGasPrice.mockResolvedValue(1n)
    mockEstimateContractGas.mockResolvedValue(21_000n)
    mockWaitForTransactionReceipt.mockResolvedValue({ status: 'success' })
    mockWriteContract.mockResolvedValue('0xhash')
  })

  afterEach(() => {
    vi.clearAllMocks()
    // Clean environment variables
    Object.keys(defaultEnv).forEach(key => {
      delete (process.env as any)[key]
    })
  })

  const renderModal = (props = {}) => {
    const defaultProps = {
      courseId: defaultCourseId,
      isOpen: true,
      onClose: defaultOnClose,
      onSuccess: defaultOnSuccess,
      lang: 'en' as const,
    }
    return render(<DonateModal {...defaultProps} {...props} />)
  }

  describe('Basic rendering', () => {
    it('renders nothing when isOpen is false', () => {
      const { container } = renderModal({ isOpen: false })
      expect(container.firstChild).toBeNull()
    })

    it('renders nothing when courseId is null', () => {
      const { container } = renderModal({ courseId: null })
      expect(container.firstChild).toBeNull()
    })

    it('renders modal when isOpen is true and courseId is provided', async () => {
      await waitFor(() => {
        renderModal()
        expect(screen.getByText(/Donate to course/i)).toBeInTheDocument()
      })
    })

    it('shows Spanish text when lang is "es"', async () => {
      await waitFor(() => {
        renderModal({ lang: 'es' })
        expect(screen.getByText(/Donar al curso/i)).toBeInTheDocument()
      })
    })
  })

  describe('Wallet connection states', () => {
    it('shows connect wallet message when no address', async () => {
      mockUseAccount.mockReturnValue({ address: undefined })
      await waitFor(() => {
        renderModal()
        expect(screen.getByText(/Connect and sign with your wallet to donate/i)).toBeInTheDocument()
      })
    })

    it('shows connect wallet message when no wallet client', async () => {
      mockUseWalletClient.mockReturnValue({ data: undefined })
      await waitFor(() => {
        renderModal()
        expect(screen.getByText(/Connect and sign with your wallet to donate/i)).toBeInTheDocument()
      })
    })
  })

  describe('Environment variables validation', () => {
    it('shows missing contract env vars when vault address is missing', async () => {
      delete (process.env as any).NEXT_PUBLIC_DEPLOYED_AT
      await waitFor(() => {
        renderModal()
        expect(screen.getByText(/Missing contract env vars/i)).toBeInTheDocument()
      })
    })

    it('shows missing contract env vars when USDT address is missing', async () => {
      delete (process.env as any).NEXT_PUBLIC_USDT_ADDRESS
      await waitFor(() => {
        renderModal()
        expect(screen.getByText(/Missing contract env vars/i)).toBeInTheDocument()
      })
    })
  })

  describe('Balance display', () => {
    it('displays USDT balance', async () => {
      mockReadContract.mockImplementation((opts: any) => {
        if (opts.functionName === 'balanceOf') {
          return Promise.resolve(5_000_000_000n) // 5000 USDT
        }
        return Promise.resolve(6n)
      })
      await waitFor(() => {
        renderModal()
        // The balance is formatted and displayed
        expect(screen.getByText(/Your USDT Balance/i)).toBeInTheDocument()
      })
    })

    it('displays CELO balance', async () => {
      mockGetBalance.mockResolvedValue(50_000_000_000_000_000n) // 0.05 CELO
      await waitFor(() => {
        renderModal()
        expect(screen.getByText(/Your CELO \(gas\)/i)).toBeInTheDocument()
      })
    })
  })

  describe('Amount input interactions', () => {
    it('enables Max button that sets amount to full balance', async () => {
      await waitFor(() => {
        renderModal()
      })
      const maxButton = screen.getByRole('button', { name: /Max/i })
      expect(maxButton).toBeInTheDocument()

      fireEvent.click(maxButton)
      const input = screen.getByLabelText(/Amount \(USDT\)/i) as HTMLInputElement
      // Should be set to 1000 (balance of 1,000,000,000 with 6 decimals)
      expect(input.value).toBe('1000')
    })

    it('enables Clear button that clears amount', async () => {
      await waitFor(() => {
        renderModal()
      })
      const input = screen.getByLabelText(/Amount \(USDT\)/i)
      fireEvent.change(input, { target: { value: '50' } })
      expect((input as HTMLInputElement).value).toBe('50')

      const clearButton = screen.getByRole('button', { name: /Clear/i })
      fireEvent.click(clearButton)
      expect((input as HTMLInputElement).value).toBe('')
    })

    it('disables donate button when amount is empty', async () => {
      await waitFor(() => {
        renderModal()
      })
      const donateButton = screen.getByRole('button', { name: /Approve & Donate|Donate/i })
      expect(donateButton).toBeDisabled()
    })

    it('enables donate button when valid amount is entered', async () => {
      await waitFor(() => {
        renderModal()
      })
      const input = screen.getByLabelText(/Amount \(USDT\)/i)
      fireEvent.change(input, { target: { value: '1' } })

      await waitFor(() => {
        const donateButton = screen.getByRole('button', { name: /Approve & Donate|Donate/i })
        expect(donateButton).not.toBeDisabled()
      })
    })
  })

  describe('Gas estimation states', () => {
    it('shows "Enough gas estimated" when gas is sufficient', async () => {
      mockGetBalance.mockResolvedValue(100_000_000_000_000_000n) // 0.1 CELO - plenty
      await waitFor(() => {
        renderModal()
      })
      const input = screen.getByLabelText(/Amount \(USDT\)/i)
      fireEvent.change(input, { target: { value: '1' } })

      await waitFor(() => {
        expect(screen.getByText(/Enough gas estimated/i)).toBeInTheDocument()
      })
    })

    it('shows "Not enough gas for transaction" when gas is insufficient', async () => {
      mockGetBalance.mockResolvedValue(100n) // Very little CELO
      await waitFor(() => {
        renderModal()
      })
      const input = screen.getByLabelText(/Amount \(USDT\)/i)
      fireEvent.change(input, { target: { value: '1' } })

      await waitFor(() => {
        expect(screen.getByText(/Not enough gas for transaction/i)).toBeInTheDocument()
      })
    })

    it('shows warning when gas estimation fails', async () => {
      mockEstimateContractGas.mockRejectedValue(new Error('Estimation failed'))
      await waitFor(() => {
        renderModal()
      })
      const input = screen.getByLabelText(/Amount \(USDT\)/i)
      fireEvent.change(input, { target: { value: '1' } })

      await waitFor(() => {
        expect(screen.getByText(/Gas estimation failed, proceed at your own risk/i)).toBeInTheDocument()
      })
    })
  })

  describe('Approval flow', () => {
    it('shows "Approve & Donate" when allowance is insufficient', async () => {
      mockReadContract.mockImplementation((opts: any) => {
        if (opts.functionName === 'allowance') {
          return Promise.resolve(0n) // No allowance
        }
        return Promise.resolve(6n)
      })
      await waitFor(() => {
        renderModal()
      })
      const input = screen.getByLabelText(/Amount \(USDT\)/i)
      fireEvent.change(input, { target: { value: '100' } })

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /Approve & Donate/i })
        expect(button).toBeInTheDocument()
      })
    })

    it('shows "Donate" when allowance is sufficient', async () => {
      mockReadContract.mockImplementation((opts: any) => {
        if (opts.functionName === 'allowance') {
          return Promise.resolve(parseUserAmount('1000', 6)) // Allowance for full balance
        }
        return Promise.resolve(6n)
      })
      await waitFor(() => {
        renderModal()
      })
      const input = screen.getByLabelText(/Amount \(USDT\)/i)
      fireEvent.change(input, { target: { value: '100' } })

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /Donate/i })
        expect(button).toBeInTheDocument()
      })
    })
  })

  describe('Donation flow', () => {
    it('calls onSuccess when donation succeeds', async () => {
      await waitFor(() => {
        renderModal()
      })
      const input = screen.getByLabelText(/Amount \(USDT\)/i)
      fireEvent.change(input, { target: { value: '10' } })

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /Approve & Donate/i })
        expect(button).not.toBeDisabled()
      })

      const donateButton = screen.getByRole('button', { name: /Approve & Donate/i })
      await act(async () => {
        fireEvent.click(donateButton)
      })

      await waitFor(() => {
        expect(defaultOnSuccess).toHaveBeenCalled()
      })
    })

    it('calls onClose when cancel button is clicked', async () => {
      await waitFor(() => {
        renderModal()
      })
      const cancelButton = screen.getByRole('button', { name: /Cancel/i })
      fireEvent.click(cancelButton)
      expect(defaultOnClose).toHaveBeenCalled()
    })

    it('shows error message when transaction fails', async () => {
      mockWriteContract.mockRejectedValue(new Error('Transaction failed'))
      await waitFor(() => {
        renderModal()
      })
      const input = screen.getByLabelText(/Amount \(USDT\)/i)
      fireEvent.change(input, { target: { value: '10' } })

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /Approve & Donate/i })
        expect(button).not.toBeDisabled()
      })

      const donateButton = screen.getByRole('button', { name: /Approve & Donate/i })
      await act(async () => {
        fireEvent.click(donateButton)
      })

      await waitFor(() => {
        expect(screen.getByText(/Transaction failed/i)).toBeInTheDocument()
      })
    })
  })

  describe('Utility functions', () => {
    describe('parseUserAmount', () => {
      it('parses valid integer amount', () => {
        expect(parseUserAmount('100', 6)).toBe(100_000_000n)
      })

      it('parses valid decimal amount', () => {
        expect(parseUserAmount('0.5', 6)).toBe(500_000n)
      })

      it('handles comma as decimal separator', () => {
        expect(parseUserAmount('0,5', 6)).toBe(500_000n)
      })

      it('throws error for invalid input', () => {
        expect(() => parseUserAmount('abc', 6)).toThrow('Invalid number')
      })

      it('returns 0n for empty string', () => {
        expect(parseUserAmount('', 6)).toBe(0n)
      })
    })
  })
})