import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

// Mock de SDKs
const { mockUseIdentitySDK, mockClaimSDK, mockClaimSDKInstance } = vi.hoisted(
  () => {
    const mockUseIdentitySDK = vi.fn()
    const mockClaimSDKInstance = { claim: vi.fn() }
    const mockClaimSDK = vi.fn(() => mockClaimSDKInstance)
    return { mockUseIdentitySDK, mockClaimSDK, mockClaimSDKInstance }
  },
)

vi.mock('@goodsdks/citizen-sdk', () => ({
  ClaimSDK: mockClaimSDK,
  IdentitySDK: vi.fn(),
}))

vi.mock('@goodsdks/react-hooks', () => ({
  useIdentitySDK: mockUseIdentitySDK,
}))

// Mock de next-auth/react
const { mockUseSession } = vi.hoisted(() => {
  const mockUseSession = vi.fn()
  return { mockUseSession }
})
vi.mock('next-auth/react', () => ({
  useSession: mockUseSession,
}))

// Mock de wagmi
const { mockUseAccount, mockUsePublicClient, mockUseWalletClient } = vi.hoisted(
  () => {
    const mockUseAccount = vi.fn()
    const mockUsePublicClient = vi.fn()
    const mockUseWalletClient = vi.fn()
    return { mockUseAccount, mockUsePublicClient, mockUseWalletClient }
  },
)
vi.mock('@/lib/hooks/useAuthAddress', () => ({
  useAuthAddress: mockUseAccount,
}))
vi.mock('@/lib/hooks/useWallet', () => ({
  usePublicClient: mockUsePublicClient,
  useWalletClient: mockUseWalletClient,
}))

// Mock de la billetera in-app (R-#271)
const { mockUseInAppWallet, mockOpenInAppWalletDialog } = vi.hoisted(() => ({
  mockUseInAppWallet: vi.fn(),
  mockOpenInAppWalletDialog: vi.fn(),
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
    // Reset mocks and state before each test
    vi.clearAllMocks()
    mockConfig.IS_PRODUCTION = true // Default to production environment
    // Set environment variable for CELO network
    vi.stubEnv('NEXT_PUBLIC_NETWORK', 'celo')

    // Default mocks for a successful use case
    mockUseSession.mockReturnValue({
      data: {
        address: mockAddress,
        user: { token: 'mock-token' },
      },
      status: 'authenticated',
    })
    mockUseAccount.mockReturnValue({
      address: mockAddress,
      isConnected: true,
    })
    mockUsePublicClient.mockReturnValue({} as any)
    mockUseWalletClient.mockReturnValue({ data: {} as any })
    mockUseInAppWallet.mockReturnValue({ status: 'unlocked', biometricEnabled: false })
    
    // NEW API: returns { sdk, loading, error }
    mockUseIdentitySDK.mockReturnValue({ 
      sdk: { getWhitelistedRoot: vi.fn() }, 
      loading: false, 
      error: null 
    })
    
    mockClaimSDKInstance.claim.mockResolvedValue({ txHash: '0xmocktxhash' })

    // Global mocks — fetch still needed for API call
    global.window.fetch = vi.fn(() =>
      Promise.resolve({ 
        ok: true, 
        json: () => Promise.resolve({ success: true, claimNumber: 5 }) 
      } as any),
    )
  })

  afterEach(() => {
    // Ensure mock state is reset after each test
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
    mockUseAccount.mockReturnValue({ address: undefined, isConnected: false })

    render(<GoodDollarClaimButton lang="en" />)

    expect(
      screen.getByText(/Connect your wallet to claim/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('displays loading state while claiming', async () => {
    render(<GoodDollarClaimButton lang="en" />)
    fireEvent.click(screen.getByRole('button'))

    expect(await screen.findByText(/Claiming.../i)).toBeInTheDocument()
    // Check that the claim function was actually called
    expect(mockClaimSDKInstance.claim).toHaveBeenCalledTimes(1)
  })

  it('shows success toast on successful claim', async () => {
    render(<GoodDollarClaimButton lang="en" />)
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(mockToastFn).toHaveBeenCalledWith({
        title: 'Claim successful',
      })
    })

    const button = screen.getByRole('button', {
      name: /Sign up with GoodDollar or Claim UBI/i,
    })
    expect(button).not.toBeDisabled()
  })

  it('shows an error toast when claim fails', async () => {
    const error = new Error('Network error')
    mockClaimSDKInstance.claim.mockRejectedValue(error)
    render(<GoodDollarClaimButton lang="en" />)

    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(mockToastFn).toHaveBeenCalledWith(expect.objectContaining({
        title: expect.stringContaining('Claim failed'),
        variant: 'destructive',
      }))
    })
  })

  it('in development (Celo Sepolia) GoodDollar is not available: no claim, honest reason', () => {
    // GoodDollar UBI no existe en Celo Sepolia (el SDK soporta 50/122/42220):
    // el botón lo dice y no intenta reclamar en vez de fingir que sí.
    mockConfig.IS_PRODUCTION = false

    render(<GoodDollarClaimButton lang="en" />)

    expect(screen.getByText(/GoodDollar UBI is only on Celo mainnet/i)).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeDisabled()
    expect(mockClaimSDKInstance.claim).not.toHaveBeenCalled()
  })

  it('accepts custom button text', () => {
    render(<GoodDollarClaimButton lang="en" buttonText="Custom Text" />)
    expect(
      screen.getByRole('button', { name: /Custom Text/i }),
    ).toBeInTheDocument()
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
    expect(mockClaimSDKInstance.claim).not.toHaveBeenCalled()
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
})
