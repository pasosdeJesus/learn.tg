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

// El barrel @pasosdejesus/m/debug crashea el worker de Node en OpenBSD (mismo
// workaround que `app/[lang]/[pathPrefix]/__tests__/page.test.tsx`); el botón solo
// lo usa para loguear el diagnóstico.
vi.mock('@pasosdejesus/m/debug', () => ({
  logger: { info: vi.fn(), error: vi.fn(), success: vi.fn(), warning: vi.fn(), debug: vi.fn() },
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
  mockUseWalletProvider,
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
    mockUseWalletProvider: vi.fn(),
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
vi.mock('@/lib/hooks/useWalletProvider', () => ({
  useWalletProvider: mockUseWalletProvider,
}))
vi.mock('@pasosdejesus/m/wallet/next', () => ({
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
    mockUseWalletProvider.mockReturnValue({ provider: null, isInApp: false, isInAppUnlocked: false, externalAvailable: false })
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
    await waitFor(() =>
      expect(mockToastFn).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Claim successful' }),
      ),
    )
    const toastArg = mockToastFn.mock.calls[mockToastFn.mock.calls.length - 1][0] as {
      duration: number
      description: { props: { href: string; children: string } }
    }
    expect(toastArg.duration).toBe(Infinity)
    expect(toastArg.description.props.href).toBe('https://celo.blockscout.com/tx/0xhash')
    expect(toastArg.description.props.children).toBe('View transaction')
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

  // GoodID responde "Login information is missing" si el mensaje firmado lleva la
  // dirección en minúsculas (medido 2026-10-02 con Chrome): el mensaje debe llevar la
  // forma EIP-55 y el enlace el mismo `account`.
  it('signs the FV message with the EIP-55 address and sends it as account', async () => {
    mockState.whitelistedRoot = zeroAddress
    const lower = '0x2e2c4ac19c93d0984840cdd8e7f77500e2ef978e'
    const checksummed = '0x2e2c4AC19c93d0984840cDD8E7f77500e2ef978e'
    mockUseSession.mockReturnValue({ data: { address: lower }, status: 'authenticated' })
    mockUseAuthAddress.mockReturnValue({ address: lower, isConnected: true })

    render(<GoodDollarClaimButton lang="en" />)

    const button = screen.getByTestId('gooddollar-claim-button')
    await waitFor(() => expect(button).toHaveAttribute('data-action', 'verify'))

    fireEvent.click(button)

    await waitFor(() =>
      expect(mockSignMessage).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining(checksummed) }),
      ),
    )
    const signed = mockSignMessage.mock.calls[mockSignMessage.mock.calls.length - 1][0] as {
      message: string
    }
    expect(signed.message).not.toContain(lower)
    await waitFor(() =>
      expect(mockAssign).toHaveBeenCalledWith(expect.stringContaining(`account=${checksummed}`)),
    )
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

  it('uses the connected external wallet even when the in-app one is locked (operator report)', async () => {
    // OKX conectada en escritorio con una billetera in-app bloqueada de antes:
    // el botón no debe decir "unlock in-app", debe reclamar con la externa.
    mockUseInAppWallet.mockReturnValue({ status: 'locked', biometricEnabled: false })

    render(<GoodDollarClaimButton lang="en" />)

    const button = screen.getByTestId('gooddollar-claim-button')
    await waitFor(() => expect(button).toHaveAttribute('data-action', 'direct-claim'))
    expect(
      screen.queryByRole('button', { name: /Unlock your in-app wallet/i }),
    ).not.toBeInTheDocument()

    fireEvent.click(button)
    await waitFor(() => expect(mockWriteContract).toHaveBeenCalledTimes(1))
    expect(mockOpenInAppWalletDialog).not.toHaveBeenCalled()
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

  it('asks to change the network when the wallet is on another chain (R-#266)', async () => {
    mockUseWalletProvider.mockReturnValue({ provider: { isPdJWallet: true }, isInApp: true, isInAppUnlocked: true, externalAvailable: false })
    mockUseWalletClient.mockReturnValue({
      data: {
        signMessage: mockSignMessage,
        getChainId: vi.fn().mockResolvedValue(11142220),
        switchChain: vi.fn().mockRejectedValue(new Error('cannot switch')),
        addChain: vi.fn().mockRejectedValue(new Error('cannot add')),
      },
    })

    render(<GoodDollarClaimButton lang="en" />)

    const button = screen.getByTestId('gooddollar-claim-button')
    await waitFor(() => expect(button).toHaveAttribute('data-action', 'direct-claim'))
    fireEvent.click(button)

    await waitFor(() =>
      expect(mockToastFn).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('could not switch your in-app wallet'),
          variant: 'destructive',
        }),
      ),
    )
    expect(mockWriteContract).not.toHaveBeenCalled()
  })
})
