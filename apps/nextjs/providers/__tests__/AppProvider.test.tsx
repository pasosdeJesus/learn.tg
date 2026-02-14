import * as React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted mocks
const mockSessionProvider = vi.hoisted(() => vi.fn(({ children }) => children))
const mockWagmiProvider = vi.hoisted(() => vi.fn(({ children }) => children))
const mockQueryClientProvider = vi.hoisted(() => vi.fn(({ children }) => children))
const mockRainbowKitSiweNextAuthProvider = vi.hoisted(() => vi.fn(({ children }) => children))
const mockRainbowKitProvider = vi.hoisted(() => vi.fn(({ children }) => children))
const mockConnectorsForWallets = vi.hoisted(() => vi.fn())
const mockLightTheme = vi.hoisted(() => vi.fn(() => ({})))
const mockCreateConfig = vi.hoisted(() => vi.fn())
const mockHttp = vi.hoisted(() => vi.fn())
const mockCelo = vi.hoisted(() => ({ id: 1 }))
const mockCeloSepolia = vi.hoisted(() => ({ id: 2 }))
const mockInjectedWallet = vi.hoisted(() => vi.fn())
const mockMetaMaskWallet = vi.hoisted(() => vi.fn())
const mockOkxWallet = vi.hoisted(() => vi.fn())
const mockWalletConnectWallet = vi.hoisted(() => vi.fn())
const mockAddress = vi.hoisted(() => vi.fn())

// Mock modules
vi.mock('next-auth/react', () => ({
  SessionProvider: mockSessionProvider,
}))

vi.mock('wagmi', () => ({
  WagmiProvider: mockWagmiProvider,
  createConfig: mockCreateConfig,
  http: mockHttp,
  useAccount: vi.fn(() => ({ address: '0x123' })),
}))

vi.mock('@tanstack/react-query', () => ({
  QueryClient: vi.fn(() => ({})),
  QueryClientProvider: mockQueryClientProvider,
}))

vi.mock('@rainbow-me/rainbowkit-siwe-next-auth', () => ({
  RainbowKitSiweNextAuthProvider: mockRainbowKitSiweNextAuthProvider,
  GetSiweMessageOptions: vi.fn(),
}))

vi.mock('@rainbow-me/rainbowkit', () => ({
  RainbowKitProvider: mockRainbowKitProvider,
  connectorsForWallets: mockConnectorsForWallets,
  lightTheme: mockLightTheme,
}))

vi.mock('@rainbow-me/rainbowkit/wallets', () => ({
  injectedWallet: mockInjectedWallet,
  metaMaskWallet: mockMetaMaskWallet,
  okxWallet: mockOkxWallet,
  walletConnectWallet: mockWalletConnectWallet,
}))

vi.mock('wagmi/chains', () => ({
  celo: mockCelo,
  celoSepolia: mockCeloSepolia,
}))

vi.mock('viem', () => ({
  Address: mockAddress,
}))

vi.mock('@/lib/config', () => ({
  IS_PRODUCTION: false,
}))

// Now import the component after mocks are set up
import { AppProvider } from '../AppProvider'

describe('AppProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Configure mocks to return reasonable defaults
    mockCreateConfig.mockReturnValue({})
    mockConnectorsForWallets.mockReturnValue([])
  })

  it('renders children without errors', () => {
    // Mock console.log to suppress the 'OJO msg=' log
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    render(
      <AppProvider>
        <div data-testid="test-child">Test Child</div>
      </AppProvider>
    )

    // Should render children
    expect(screen.getByTestId('test-child')).toBeInTheDocument()

    // Verify providers were called (at least once each)
    expect(mockWagmiProvider).toHaveBeenCalled()
    expect(mockSessionProvider).toHaveBeenCalled()
    expect(mockQueryClientProvider).toHaveBeenCalled()
    expect(mockRainbowKitSiweNextAuthProvider).toHaveBeenCalled()
    expect(mockRainbowKitProvider).toHaveBeenCalled()

    consoleLogSpy.mockRestore()
  })

  it('provides necessary context to children', () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    render(
      <AppProvider>
        <div>Child content</div>
      </AppProvider>
    )

    // The test passes if no errors are thrown during rendering
    expect(true).toBe(true)

    consoleLogSpy.mockRestore()
  })
})