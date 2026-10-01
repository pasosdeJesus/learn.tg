import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { zeroAddress } from 'viem'
import GoodDollarClaimButton from '../GoodDollarClaimButton'

// --- Mocks --- //

// Hoisted mock for controlling the IS_PRODUCTION flag from within tests.
const { mockConfig } = vi.hoisted(() => {
  const config = {
    IS_PRODUCTION: true,
  }
  return {
    mockConfig: config,
  }
})
vi.mock('@learn-tg/rewards/lib/config', () => ({
  __esModule: true,
  get IS_PRODUCTION() {
    return mockConfig.IS_PRODUCTION
  },
}))

vi.mock('@/lib/hooks/useTranslation', () => ({
  createComponentT: (lang: string, translations: Record<string, Record<string, string>>) => {
    const dict = translations[lang] || translations.en || {}
    return (key: string, ...args: string[]) => {
      let val = dict[key] || key
      args.forEach((arg, i) => { val = val.replace(`{{${i}}}`, arg) })
      return val
    }
  },
}))

// Mock de useToast
const { mockUseToast, mockToastFn } = vi.hoisted(() => {
  const mockToastFn = vi.fn()
  const mockUseToast = vi.fn(() => ({
    toast: mockToastFn,
  }))
  return { mockUseToast, mockToastFn }
})
vi.mock('@pasosdejesus/m/shadcn-components/ui/use-toast', () => ({
  useToast: mockUseToast,
}))

// The protocol is read through usePublicClient; the write goes through useWriteContract.
// The citizen-sdk is no longer part of the claim path (R-#275).
const {
  mockUseSession,
  mockUseAuthAddress,
  mockReadContract,
  mockGetCode,
  mockSignMessage,
  mockWriteContract,
  mockUseInAppWallet,
  mockUsePublicClient,
  mockUseWalletClient,
  mockUseWriteContract,
  mockOpenInAppWalletDialog,
  mockAssign,
  mockState,
} = vi.hoisted(() => {
  const mockState = {
    whitelistedRoot: '0x1111111111111111111111111111111111111111',
    entitlement: 5n as bigint,
  }
  const mockGetCode = vi.fn()
  const mockReadContract = vi.fn(async ({ functionName }: { functionName: string }) => {
    if (functionName === 'getWhitelistedRoot') return mockState.whitelistedRoot
    if (functionName === 'checkEntitlement') return mockState.entitlement
    if (functionName === 'paused') return false
    if (functionName === 'decimals') return 18
    return null
  })
  return {
    mockUseSession: vi.fn(),
    mockUseAuthAddress: vi.fn(),
    mockReadContract,
    mockGetCode,
    mockSignMessage: vi.fn(),
    mockWriteContract: vi.fn(),
    mockUseInAppWallet: vi.fn(),
    mockUsePublicClient: vi.fn(),
    mockUseWalletClient: vi.fn(),
    mockUseWriteContract: vi.fn(),
    mockOpenInAppWalletDialog: vi.fn(),
    mockAssign: vi.fn(),
    mockState,
  }
})

vi.mock('next-auth/react', () => ({
  useSession: mockUseSession,
}))
vi.mock('@/lib/hooks/useAuthAddress', () => ({
  useAuthAddress: mockUseAuthAddress,
}))
vi.mock('@/lib/hooks/useWallet', () => ({
  usePublicClient: mockUsePublicClient,
  useWalletClient: mockUseWalletClient,
}))
vi.mock('@/lib/hooks/useWriteContract', () => ({
  useWriteContract: mockUseWriteContract,
}))
vi.mock('@learn-tg/pdj-wallet-next', () => ({
  useInAppWallet: mockUseInAppWallet,
}))
vi.mock('@/lib/in-app-wallet-dialog', () => ({
  openInAppWalletDialog: mockOpenInAppWalletDialog,
  OPEN_IN_APP_WALLET_DIALOG: 'learn-tg:open-in-app-wallet-dialog',
}))

// --- Tests --- //

describe('GoodDollarClaimButton', () => {
  const mockAddress = '0x1234567890123456789012345678901234567890'

  beforeEach(() => {
    vi.clearAllMocks()
    mockConfig.IS_PRODUCTION = true
    vi.stubEnv('NEXT_PUBLIC_NETWORK', 'celo')

    mockState.whitelistedRoot = '0x1111111111111111111111111111111111111111'
    mockState.entitlement = 5n

    mockUseSession.mockReturnValue({
      data: { address: mockAddress, user: { token: 'mock-token' } },
      status: 'authenticated',
    })
    mockUseAuthAddress.mockReturnValue({ address: mockAddress, isConnected: true })
    mockGetCode.mockResolvedValue('0x6000')
    mockUsePublicClient.mockReturnValue({ readContract: mockReadContract, getCode: mockGetCode })
    mockSignMessage.mockResolvedValue('0xdeadbeef')
    mockUseWalletClient.mockReturnValue({ data: { signMessage: mockSignMessage } })
    mockWriteContract.mockResolvedValue('0xhash')
    mockUseWriteContract.mockReturnValue({ writeContract: mockWriteContract, data: undefined })
    mockUseInAppWallet.mockReturnValue({ status: 'unlocked', biometricEnabled: false })

    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: {
        href: 'https://learn.tg/en/web3-and-ubi/guide4',
        pathname: '/en/web3-and-ubi/guide4',
        assign: mockAssign,
      },
    })
  })

  afterEach(() => {
    mockConfig.IS_PRODUCTION = true
    vi.unstubAllEnvs()
  })

  it('renders the button with Spanish text when lang="es"', () => {
    render(<GoodDollarClaimButton lang="es" />)
    expect(
      screen.getByRole('button', {
        name: /Regístrate con GoodDollar o reclama UBI/i,
      }),
    ).toBeInTheDocument()
  })

  it('shows connect wallet message when there is no session', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' })
    mockUseAuthAddress.mockReturnValue({ address: undefined, isConnected: false })

    render(<GoodDollarClaimButton lang="en" />)

    expect(screen.getByText(/Connect your wallet to claim/i)).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('claims directly on-chain when whitelisted and entitled (R-#275)', async () => {
    render(<GoodDollarClaimButton lang="en" />)

    const button = screen.getByTestId('gooddollar-claim-button')
    await waitFor(() => expect(button).toHaveAttribute('data-action', 'direct-claim'))

    fireEvent.click(button)

    await waitFor(() =>
      expect(mockWriteContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: '0x43d72Ff17701B2DA814620735C39C620Ce0ea4A1',
          functionName: 'claim',
        }),
      ),
    )
    await waitFor(() => expect(mockToastFn).toHaveBeenCalledWith({ title: 'Claim successful' }))
    expect(mockSignMessage).not.toHaveBeenCalled()
  })

  it('signs the fixed FV message and opens GoodID when not whitelisted, without writing', async () => {
    mockState.whitelistedRoot = zeroAddress

    render(<GoodDollarClaimButton lang="en" />)

    const button = screen.getByTestId('gooddollar-claim-button')
    await waitFor(() => expect(button).toHaveAttribute('data-action', 'verify'))

    fireEvent.click(button)

    await waitFor(() =>
      expect(mockSignMessage).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('request verifying your account') }),
      ),
    )
    await waitFor(() =>
      expect(mockAssign).toHaveBeenCalledWith(expect.stringContaining('goodid.gooddollar.org')),
    )
    expect(mockWriteContract).not.toHaveBeenCalled()
  })

  it('says you already claimed today instead of offering a doomed claim', async () => {
    mockState.entitlement = 0n

    render(<GoodDollarClaimButton lang="en" />)

    const button = screen.getByTestId('gooddollar-claim-button')
    await waitFor(() => expect(button).toHaveAttribute('data-action', 'nothing-today'))
    expect(screen.getByRole('button', { name: /You already claimed today/i })).toBeDisabled()
    expect(mockWriteContract).not.toHaveBeenCalled()
  })

  it('stops with a message when the protocol changed, instead of failing silently', async () => {
    mockGetCode.mockResolvedValue(undefined)

    render(<GoodDollarClaimButton lang="en" />)

    await waitFor(() =>
      expect(screen.getByText(/GoodDollar changed something on its side/i)).toBeInTheDocument(),
    )
    expect(mockWriteContract).not.toHaveBeenCalled()
  })

  it('offers to unlock a locked in-app wallet instead of blaming testnet (R-#271)', () => {
    mockUseInAppWallet.mockReturnValue({ status: 'locked', biometricEnabled: false })
    mockUseWalletClient.mockReturnValue({ data: null })

    render(<GoodDollarClaimButton lang="en" />)

    const button = screen.getByRole('button', { name: /Unlock your in-app wallet/i })
    expect(button).not.toBeDisabled()
    expect(screen.queryByText(/Not available on testnet/i)).not.toBeInTheDocument()

    fireEvent.click(button)
    expect(mockOpenInAppWalletDialog).toHaveBeenCalledTimes(1)
    expect(mockWriteContract).not.toHaveBeenCalled()
  })

  it('uses the gesture wording when biometric is enabled', () => {
    mockUseInAppWallet.mockReturnValue({ status: 'locked', biometricEnabled: true })
    mockUseWalletClient.mockReturnValue({ data: null })

    render(<GoodDollarClaimButton lang="es" />)
    expect(
      screen.getByRole('button', { name: /Desbloquear con huella o Face ID/i }),
    ).toBeInTheDocument()
  })

  it('names an unsupported provider instead of testnet when there is no signer', () => {
    mockUseInAppWallet.mockReturnValue({ status: 'no-wallet', biometricEnabled: false })
    mockUseWalletClient.mockReturnValue({ data: null })

    render(<GoodDollarClaimButton lang="en" />)

    expect(screen.getByText(/cannot sign the GoodDollar verification/i)).toBeInTheDocument()
    expect(screen.queryByText(/Not available on testnet/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('in development (Celo Sepolia) GoodDollar is not available: no claim, honest reason', async () => {
    mockConfig.IS_PRODUCTION = false

    render(<GoodDollarClaimButton lang="en" />)

    expect(screen.getByText(/only on Celo mainnet/i)).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.queryByText(/testnet/i)).not.toBeInTheDocument()

    const button = screen.getByTestId('gooddollar-claim-button')
    await waitFor(() => expect(button).toHaveAttribute('data-action', 'unsupported-chain'))
    expect(mockWriteContract).not.toHaveBeenCalled()
  })

  it('displays loading state while claiming', async () => {
    mockWriteContract.mockReturnValue(new Promise(() => {}))

    render(<GoodDollarClaimButton lang="en" />)

    const button = screen.getByTestId('gooddollar-claim-button')
    await waitFor(() => expect(button).toHaveAttribute('data-action', 'direct-claim'))

    fireEvent.click(button)
    expect(await screen.findByText(/Claiming.../i)).toBeInTheDocument()
  })

  it('shows an error toast when the claim fails', async () => {
    mockWriteContract.mockRejectedValue(new Error('Network error'))

    render(<GoodDollarClaimButton lang="en" />)

    const button = screen.getByTestId('gooddollar-claim-button')
    await waitFor(() => expect(button).toHaveAttribute('data-action', 'direct-claim'))

    fireEvent.click(button)

    await waitFor(() =>
      expect(mockToastFn).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('Claim failed'),
          variant: 'destructive',
        }),
      ),
    )
  })

  it('accepts custom button text', () => {
    render(<GoodDollarClaimButton lang="en" buttonText="Custom Text" />)
    expect(screen.getByRole('button', { name: /Custom Text/i })).toBeInTheDocument()
  })
})
