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
  /** Chain ID for wallet connection (default: 1) */
  chainId?: number
  /** Whether to mock axios module (default: true) */
  mockAxios?: boolean
  /** Axios mock configuration - can provide custom mock implementations */
  axiosMock?: {
    get?: (...args: any[]) => any
    post?: (...args: any[]) => any
    put?: (...args: any[]) => any
    delete?: (...args: any[]) => any
    [key: string]: any
  }
  /** Whether to mock wagmi module (default: true) */
  mockWagmi?: boolean
  /** Whether to mock siwe module (default: true) */
  mockSiwe?: boolean
  /** Whether to mock next-auth/react module (default: true) */
  mockNextAuth?: boolean
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
    chainId = 1,
    mockAxios = true,
    axiosMock = {},
    mockWagmi = true,
    mockSiwe = true,
    mockNextAuth = true,
  } = config

  // Capture axiosMock for use in hoisted functions
  const capturedAxiosMock = axiosMock

  // Hoisted mocks to avoid initialization issues
  const mocks = vi.hoisted(() => {
    const mockSiweMessage = vi.fn()
    const mockGetCsrfToken = vi.fn()
    const mockUseSession = vi.fn()
    const mockUseAccount = vi.fn()
    const mockAxiosGet = vi.fn()
    const mockAxiosPost = vi.fn()
    const mockAxiosPut = vi.fn()
    const mockAxiosDelete = vi.fn()
    const mockAxiosRequest = vi.fn()

    return {
      mockSiweMessage,
      mockGetCsrfToken,
      mockUseSession,
      mockUseAccount,
      mockAxiosGet,
      mockAxiosPost,
      mockAxiosPut,
      mockAxiosDelete,
      mockAxiosRequest,
    }
  })

  /**
   * Setup vi.mock calls for authentication modules
   * Call this in your test file's setup
   */
  function setupMocks() {
    // Mock siwe (Sign-In With Ethereum) if enabled
    if (mockSiwe) {
      vi.mock('siwe', () => ({
        SiweMessage: mocks.mockSiweMessage,
      }))
    }

    // Mock next-auth/react if enabled
    if (mockNextAuth) {
      vi.mock('next-auth/react', () => ({
        useSession: () => mocks.mockUseSession(),
        getCsrfToken: () => mocks.mockGetCsrfToken(),
      }))
    }

    // Mock wagmi if enabled
    if (mockWagmi) {
      vi.mock('wagmi', async () => {
        const actual = await vi.importActual<typeof import('wagmi')>('wagmi');
        return {
          ...actual,
          useAccount: () => mocks.mockUseAccount(),
        };
      })
    }

    // Mock axios for API calls if enabled
    if (mockAxios) {
      vi.mock('axios', () => ({
        default: {
          get: (...args: any[]) => mocks.mockAxiosGet(...args),
          post: (...args: any[]) => mocks.mockAxiosPost(...args),
          put: (...args: any[]) => mocks.mockAxiosPut(...args),
          delete: (...args: any[]) => mocks.mockAxiosDelete(...args),
          request: (...args: any[]) => mocks.mockAxiosRequest(...args),
        },
      }))
    }
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
        data: { nonce: 'mock-nonce', chainId },
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
      chainId,
    })

    // Axios mocks - default success responses for all methods
    // Only set defaults if custom implementation not provided
    if (!capturedAxiosMock.get) {
      mocks.mockAxiosGet.mockResolvedValue({
        data: {},
        status: 200,
      })
    } else {
      mocks.mockAxiosGet.mockImplementation(capturedAxiosMock.get)
    }
    if (!capturedAxiosMock.post) {
      mocks.mockAxiosPost.mockResolvedValue({
        data: {},
        status: 200,
      })
    } else {
      mocks.mockAxiosPost.mockImplementation(capturedAxiosMock.post)
    }
    if (!capturedAxiosMock.put) {
      mocks.mockAxiosPut.mockResolvedValue({
        data: {},
        status: 200,
      })
    } else {
      mocks.mockAxiosPut.mockImplementation(capturedAxiosMock.put)
    }
    if (!capturedAxiosMock.delete) {
      mocks.mockAxiosDelete.mockResolvedValue({
        data: {},
        status: 200,
      })
    } else {
      mocks.mockAxiosDelete.mockImplementation(capturedAxiosMock.delete)
    }
    if (!capturedAxiosMock.request) {
      mocks.mockAxiosRequest.mockResolvedValue({
        data: {},
        status: 200,
      })
    } else {
      mocks.mockAxiosRequest.mockImplementation(capturedAxiosMock.request)
    }
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
        chainId: newConfig.chainId ?? chainId,
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
        chainId: newConfig.chainId ?? chainId,
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

    if (newConfig.chainId !== undefined) {
      // Update chainId in account mock
      mocks.mockUseAccount.mockReturnValue({
        address,
        isConnected,
        chainId: newConfig.chainId,
      })
      // Update chainId in SIWE mock
      mocks.mockSiweMessage.mockImplementation(() => ({
        address,
        verify: vi.fn().mockResolvedValue({
          success: siweVerificationSuccess,
          data: { nonce: 'mock-nonce', chainId: newConfig.chainId },
        }),
      }))
    }

    if (newConfig.siweVerificationSuccess !== undefined) {
      mocks.mockSiweMessage.mockImplementation(() => ({
        address,
        verify: vi.fn().mockResolvedValue({
          success: newConfig.siweVerificationSuccess,
          data: { nonce: 'mock-nonce', chainId: newConfig.chainId ?? chainId },
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


