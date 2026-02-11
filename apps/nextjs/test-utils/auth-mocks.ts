/**
 * Authentication mocking utilities for tests
 *
 * "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)
 */

import { vi } from 'vitest'

/**
 * Mock configurations for authentication
 */
export interface AuthMockConfig {
  address?: string
  isConnected?: boolean
  sessionData?: any
  csrfToken?: string
  siweVerificationSuccess?: boolean
}

/**
 * Creates authentication mocks with configurable behavior
 *
 * @param config Configuration for mock behavior
 * @returns Object containing mocked authentication functions and setup helpers
 */
export function createAuthMocks(config: AuthMockConfig = {}) {
  const {
    address = '0x1234567890123456789012345678901234567890',
    isConnected = true,
    sessionData = { user: { name: 'Test User' } },
    csrfToken = 'mock-csrf-token',
    siweVerificationSuccess = true,
  } = config

  // Hoisted mocks to avoid initialization issues
  const mocks = vi.hoisted(() => {
    const mockSiweMessage = vi.fn()
    const mockGetCsrfToken = vi.fn()
    const mockUseSession = vi.fn()
    const mockUseAccount = vi.fn()
    const mockAxiosGet = vi.fn()

    return {
      mockSiweMessage,
      mockGetCsrfToken,
      mockUseSession,
      mockUseAccount,
      mockAxiosGet,
    }
  })

  /**
   * Setup vi.mock calls for authentication modules
   * Call this in your test file's setup
   */
  function setupMocks() {
    // Mock siwe (Sign-In With Ethereum)
    vi.mock('siwe', () => ({
      SiweMessage: mocks.mockSiweMessage,
    }))

    // Mock next-auth/react
    vi.mock('next-auth/react', () => ({
      useSession: () => mocks.mockUseSession(),
      getCsrfToken: () => mocks.mockGetCsrfToken(),
    }))

    // Mock wagmi
    vi.mock('wagmi', () => ({
      useAccount: () => mocks.mockUseAccount(),
    }))

    // Mock axios for API calls
    vi.mock('axios', () => ({
      default: {
        get: (...args: any[]) => mocks.mockAxiosGet(...args),
      },
    }))
  }

  /**
   * Set up default mock implementations based on config
   */
  function setupDefaultImplementations() {
    // SiweMessage mock
    mocks.mockSiweMessage.mockImplementation(() => ({
      address,
      verify: vi.fn().mockResolvedValue({
        success: siweVerificationSuccess,
        data: { nonce: 'mock-nonce', chainId: 1 },
      }),
    }))

    // NextAuth mocks
    mocks.mockUseSession.mockReturnValue({
      data: {
        ...sessionData,
        address,
      },
      status: 'authenticated',
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })

    mocks.mockGetCsrfToken.mockResolvedValue(csrfToken)

    // Wagmi mock
    mocks.mockUseAccount.mockReturnValue({
      address,
      isConnected,
      chainId: 1,
    })

    // Axios mock - default success response
    mocks.mockAxiosGet.mockResolvedValue({
      data: {},
      status: 200,
    })
  }

  /**
   * Reset all mock implementations
   */
  function resetMocks() {
    Object.values(mocks).forEach(mock => {
      if (typeof mock.mockReset === 'function') {
        mock.mockReset()
      }
    })
  }

  /**
   * Update mock configurations dynamically
   */
  function updateConfig(newConfig: Partial<AuthMockConfig>) {
    if (newConfig.address !== undefined) {
      mocks.mockUseAccount.mockReturnValue({
        address: newConfig.address,
        isConnected: newConfig.isConnected ?? isConnected,
        chainId: 1,
      })

      mocks.mockUseSession.mockReturnValue({
        data: {
          ...sessionData,
          address: newConfig.address,
        },
        status: 'authenticated',
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
    }

    if (newConfig.isConnected !== undefined) {
      mocks.mockUseAccount.mockReturnValue({
        address,
        isConnected: newConfig.isConnected,
        chainId: 1,
      })
    }

    if (newConfig.sessionData !== undefined) {
      mocks.mockUseSession.mockReturnValue({
        data: {
          ...newConfig.sessionData,
          address,
        },
        status: 'authenticated',
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
    }

    if (newConfig.csrfToken !== undefined) {
      mocks.mockGetCsrfToken.mockResolvedValue(newConfig.csrfToken)
    }

    if (newConfig.siweVerificationSuccess !== undefined) {
      mocks.mockSiweMessage.mockImplementation(() => ({
        address,
        verify: vi.fn().mockResolvedValue({
          success: newConfig.siweVerificationSuccess,
          data: { nonce: 'mock-nonce', chainId: 1 },
        }),
      }))
    }
  }

  return {
    mocks,
    setupMocks,
    setupDefaultImplementations,
    resetMocks,
    updateConfig,
  }
}

/**
 * Pre-configured authentication mocks for API route tests
 */
export const apiAuthMocks = createAuthMocks()

/**
 * Pre-configured authentication mocks for hook tests
 */
export const hookAuthMocks = createAuthMocks()

/**
 * Mock session for component tests
 */
export const mockSession = {
  data: {
    user: { name: 'Test User' },
    address: '0x1234567890123456789012345678901234567890',
  },
  status: 'authenticated' as const,
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
}

/**
 * Mock account for component tests
 */
export const mockAccount = {
  address: '0x1234567890123456789012345678901234567890',
  isConnected: true,
  chainId: 1,
}