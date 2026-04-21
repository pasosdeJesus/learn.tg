import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GoodDollarClaimButton } from '../GoodDollarClaimButton'

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
vi.mock('@/lib/config', () => ({
  __esModule: true,
  get IS_PRODUCTION() {
    return mockConfig.IS_PRODUCTION
  },
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
vi.mock('wagmi', () => ({
  useAccount: mockUseAccount,
  usePublicClient: mockUsePublicClient,
  useWalletClient: mockUseWalletClient,
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
    
    // NEW API: returns { sdk, loading, error }
    mockUseIdentitySDK.mockReturnValue({ 
      sdk: { getWhitelistedRoot: vi.fn() }, 
      loading: false, 
      error: null 
    })
    
    mockClaimSDKInstance.claim.mockResolvedValue({ txHash: '0xmocktxhash' })

    // Global mocks
    global.window.alert = vi.fn()
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

  it('shows alert with claim number on successful claim', async () => {
    render(<GoodDollarClaimButton lang="en" />)
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Claim number 5'))
    })
    
    const button = screen.getByRole('button', {
      name: /Sign up with GoodDollar or Claim UBI/i,
    })
    expect(button).not.toBeDisabled()
  })

  it('shows an error alert when claim fails', async () => {
    const error = new Error('Network error')
    mockClaimSDKInstance.claim.mockRejectedValue(error)
    render(<GoodDollarClaimButton lang="en" />)

    fireEvent.click(screen.getByRole('button'))

    // Wait for the error message to appear in the DOM
    expect(await screen.findByText(/Claim failed:/i)).toBeInTheDocument()
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining(`Claim failed: ${error.message}`))
  })

  it('works in development environment', async () => {
    // Arrange: Simulate non-production environment
    mockConfig.IS_PRODUCTION = false

    // Act
    render(<GoodDollarClaimButton lang="en" />)
    fireEvent.click(screen.getByRole('button'))

    // Assert: Check that it actually calls claim (no longer blocked)
    await waitFor(() => {
        expect(mockClaimSDKInstance.claim).toHaveBeenCalled()
    })
  })

  it('accepts custom button text', () => {
    render(<GoodDollarClaimButton lang="en" buttonText="Custom Text" />)
    expect(
      screen.getByRole('button', { name: /Custom Text/i }),
    ).toBeInTheDocument()
  })
})
