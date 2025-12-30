import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import GoodDollarClaimButton from '../GoodDollarClaimButton'

// Mock de @goodsdks/citizen-sdk
const { mockUseIdentitySDK, mockClaimSDK, mockClaimSDKInstance } = vi.hoisted(() => {
  const mockUseIdentitySDK = vi.fn()
  const mockClaimSDKInstance = { claim: vi.fn() }
  const mockClaimSDK = vi.fn(() => mockClaimSDKInstance)
  return { mockUseIdentitySDK, mockClaimSDK, mockClaimSDKInstance }
})
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
const { mockUseAccount, mockUsePublicClient, mockUseWalletClient } = vi.hoisted(() => {
  const mockUseAccount = vi.fn()
  const mockUsePublicClient = vi.fn()
  const mockUseWalletClient = vi.fn()
  return { mockUseAccount, mockUsePublicClient, mockUseWalletClient }
})
vi.mock('wagmi', () => ({
  useAccount: mockUseAccount,
  usePublicClient: mockUsePublicClient,
  useWalletClient: mockUseWalletClient,
}))

describe('GoodDollarClaimButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Configurar mocks por defecto
    mockUseSession.mockReturnValue({
      data: {
        address: '0x1234567890123456789012345678901234567890',
      },
      status: 'authenticated',
    })
    mockUseAccount.mockReturnValue({
      address: '0x1234567890123456789012345678901234567890',
      isConnected: true,
    })
    mockUsePublicClient.mockReturnValue({})
    mockUseWalletClient.mockReturnValue({ data: {} })
    mockUseIdentitySDK.mockReturnValue({})
    mockClaimSDKInstance.claim.mockResolvedValue(undefined)
    // Configurar variable de entorno para producción
    process.env.NEXT_PUBLIC_AUTH_URL = 'https://learn.tg'
    // Mock de alert para evitar errores de jsdom
    global.window.alert = vi.fn()
  })

  it('renderiza el botón con texto en español cuando lang="es"', () => {
    render(<GoodDollarClaimButton lang="es" />)
    expect(
      screen.getByRole('button', { name: /Regístrate con GoodDollar o reclama UBI/i }),
    ).toBeInTheDocument()
  })

  it('muestra mensaje de conectar wallet cuando no hay sesión', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' })
    mockUseAccount.mockReturnValue({ address: undefined, isConnected: false })

    render(<GoodDollarClaimButton lang="en" />)

    expect(
      screen.getByText(/Connect your wallet to claim/i),
    ).toBeInTheDocument()
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
  })

  it('el botón está deshabilitado cuando no hay wallet conectada', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' })
    mockUseAccount.mockReturnValue({ address: undefined, isConnected: false })

    render(<GoodDollarClaimButton lang="en" />)

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
  })

  it('llama a claim SDK cuando se hace clic y todo está configurado', async () => {
    render(<GoodDollarClaimButton lang="en" />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    await waitFor(() => {
      expect(mockClaimSDKInstance.claim).toHaveBeenCalledTimes(1)
    })
  })

  it('muestra estado de carga mientras reclama', async () => {
    // Simular una promesa que no se resuelve inmediatamente
    let resolveClaim: () => void
    const claimPromise = new Promise<void>((resolve) => {
      resolveClaim = () => resolve()
    })
    mockClaimSDKInstance.claim.mockReturnValue(claimPromise)

    render(<GoodDollarClaimButton lang="en" />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    // Debería mostrar "Claiming..."
    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent(/Claiming.../i)
    })

    // Resolver la promesa
    resolveClaim!()
    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent(/Sign up with GoodDollar or Claim UBI/i)
    })
  })

  it('muestra error cuando claim falla', async () => {
    const errorMessage = 'Network error'
    mockClaimSDKInstance.claim.mockRejectedValue(new Error(errorMessage))

    render(<GoodDollarClaimButton lang="en" />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText(/Claim failed:/i)).toBeInTheDocument()
    })
  })

  it('no renderiza identitySDK cuando no es entorno de producción', () => {
    process.env.NEXT_PUBLIC_AUTH_URL = 'http://localhost:3000'
    mockUseIdentitySDK.mockReturnValue(null)

    render(<GoodDollarClaimButton lang="en" />)

    const button = screen.getByRole('button')
    // El botón no está deshabilitado pero la validación en handleClaim mostrará error
    expect(button).not.toBeDisabled()
  })

  it('acepta texto personalizado del botón', () => {
    render(<GoodDollarClaimButton lang="en" buttonText="Custom button text" />)

    expect(
      screen.getByRole('button', { name: /Custom button text/i }),
    ).toBeInTheDocument()
  })
})
