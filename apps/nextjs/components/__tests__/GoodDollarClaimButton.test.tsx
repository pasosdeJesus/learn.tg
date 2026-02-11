import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import GoodDollarClaimButton from '../GoodDollarClaimButton'

// --- Mocks --- //

// Hoisted mock for controlling the IS_PRODUCTION flag from within tests.
const { mockConfig, setIsProduction } = vi.hoisted(() => {
  let isProduction = true // Encapsulated state
  return {
    mockConfig: {
      get IS_PRODUCTION() {
        return isProduction
      },
    },
    setIsProduction: (val: boolean) => {
      isProduction = val
    },
  }
})
vi.mock('@/lib/config', () => ({
  __esModule: true,
  ...mockConfig,
}))

// Mock de @goodsdks/citizen-sdk
const { mockUseIdentitySDK, mockClaimSDK, mockClaimSDKInstance } = vi.hoisted(
  () => {
    const mockUseIdentitySDK = vi.fn()
    const mockClaimSDKInstance = { claim: vi.fn() }
    const mockClaimSDK = vi.fn(() => mockClaimSDKInstance)
    return { mockUseIdentitySDK, mockClaimSDK, mockClaimSDKInstance }
  },
)
vi.mock('@goodsdks/citizen-sdk', () => ({
  useIdentitySDK: mockUseIdentitySDK,
  ClaimSDK: mockClaimSDK,
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
  beforeEach(() => {
    // Reset mocks and state before each test
    vi.clearAllMocks()
    setIsProduction(true) // Default to production environment

    // Default mocks for a successful use case
    mockUseSession.mockReturnValue({
      data: {
        address: '0x1234567890123456789012345678901234567890',
        user: { token: 'mock-token' },
      },
      status: 'authenticated',
    })
    mockUseAccount.mockReturnValue({
      address: '0x1234567890123456789012345678901234567890',
      isConnected: true,
    })
    mockUsePublicClient.mockReturnValue({} as any)
    mockUseWalletClient.mockReturnValue({ data: {} as any })
    mockUseIdentitySDK.mockReturnValue({}) // SDK is always initialized
    mockClaimSDKInstance.claim.mockResolvedValue({ txHash: '0xmocktxhash' })

    // Global mocks
    global.window.alert = vi.fn()
    global.window.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as any),
    )
  })

  afterEach(() => {
    // Ensure mock state is reset after each test
    setIsProduction(true)
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

  it('shows alert and resets state on successful claim', async () => {
    render(<GoodDollarClaimButton lang="en" />)
    fireEvent.click(screen.getByRole('button'))

    // Wait for the claim to finish and the button to reset
    const button = await screen.findByRole('button', {
      name: /Sign up with GoodDollar or Claim UBI/i,
    })

    expect(window.alert).toHaveBeenCalledWith('Claim successful')
    expect(button).not.toBeDisabled()
  })

  it('shows an error alert when claim fails', async () => {
    const error = new Error('Network error')
    mockClaimSDKInstance.claim.mockRejectedValue(error)
    render(<GoodDollarClaimButton lang="en" />)

    fireEvent.click(screen.getByRole('button'))

    // Wait for the error message to appear in the DOM
    expect(await screen.findByText(/Claim failed:/i)).toBeInTheDocument()
    expect(window.alert).toHaveBeenCalledWith(`Claim failed: ${error.message}`)
  })

  it('does NOT call claim and shows error if not in production', async () => {
    // Arrange: Simulate non-production environment
    setIsProduction(false)

    // Act
    render(<GoodDollarClaimButton lang="en" />)
    fireEvent.click(screen.getByRole('button'))

    // Assert: Use findByText to wait for the error message to appear
    const errorMessage = await screen.findByText(
      /Works only in mainnet with wallet connected/i,
    )
    expect(errorMessage).toBeInTheDocument()
    expect(mockClaimSDKInstance.claim).not.toHaveBeenCalled()
  })

  it('accepts custom button text', () => {
    render(<GoodDollarClaimButton lang="en" buttonText="Custom Text" />)
    expect(
      screen.getByRole('button', { name: /Custom Text/i }),
    ).toBeInTheDocument()
  })
})
