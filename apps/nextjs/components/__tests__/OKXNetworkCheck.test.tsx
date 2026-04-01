import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import OKXNetworkCheck from '../OKXNetworkCheck'

// --- Mocks globales --- //

// Mock para @/lib/config
const { mockConfig } = vi.hoisted(() => ({
  mockConfig: {
    IS_PRODUCTION: true,
  },
}))
vi.mock('@/lib/config', () => ({
  __esModule: true,
  get IS_PRODUCTION() {
    return mockConfig.IS_PRODUCTION
  },
}))

// Mock para @/lib/okx-switch
const { mockSwitchToCelo, mockIsOKXWallet } = vi.hoisted(() => ({
  mockSwitchToCelo: vi.fn(),
  mockIsOKXWallet: vi.fn(),
}))
vi.mock('@/lib/okx-switch', () => ({
  switchToCelo: mockSwitchToCelo,
  isOKXWallet: mockIsOKXWallet,
}))

// Mock para wagmi
const { mockUseAccount } = vi.hoisted(() => ({
  mockUseAccount: vi.fn(),
}))
vi.mock('wagmi', () => ({
  useAccount: mockUseAccount,
}))

// Mock para window y navigator
const mockClipboard = {
  writeText: vi.fn(),
}
const originalWindowOpen = window.open

// --- Configuración de pruebas --- //
describe.skip('OKXNetworkCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Configurar mocks por defecto
    mockConfig.IS_PRODUCTION = true
    mockIsOKXWallet.mockReturnValue(false)
    mockSwitchToCelo.mockResolvedValue(false) // Por defecto falla para mostrar modal

    // Mock de useAccount por defecto (wallet conectada, red correcta)
    mockUseAccount.mockReturnValue({
      chainId: 42220, // Celo mainnet
      address: '0x1234567890123456789012345678901234567890',
      isConnected: true,
      connector: { name: 'OKX Wallet', id: 'okxWallet' },
    })

    // Mock de window y navigator
    Object.defineProperty(window, 'open', {
      value: vi.fn(),
      writable: true,
    })
    Object.defineProperty(navigator, 'clipboard', {
      value: mockClipboard,
      writable: true,
    })
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 Test Browser',
      writable: true,
    })

    // Opcional: espíar console.log para debug
    // vi.spyOn(console, 'log')
  })

  afterEach(() => {
    // Restaurar window.open
    window.open = originalWindowOpen
    vi.restoreAllMocks()
  })

  // --- Pruebas básicas --- //

  it('returns null (no muestra ayuda) cuando showHelp es false', () => {
    // Por defecto, isOKXWallet retorna false, así que showHelp debería ser false
    const { container } = render(<OKXNetworkCheck />)
    expect(container.firstChild).toBeNull()
  })

  it('detecta OKX Wallet y muestra modal cuando está en red incorrecta', async () => {
    // Configurar para que sea OKX Wallet pero en red incorrecta
    mockIsOKXWallet.mockReturnValue(true)
    mockUseAccount.mockReturnValue({
      chainId: 1, // Ethereum mainnet (red incorrecta)
      address: '0x1234567890123456789012345678901234567890',
      isConnected: true,
      connector: { name: 'OKX Wallet', id: 'okxWallet' },
    })

    render(<OKXNetworkCheck />)

    // El componente debería mostrar el modal de ayuda después de la detección
    await waitFor(() => {
      expect(screen.getByText(/Wrong Network Detected/i)).toBeInTheDocument()
    })
  })

  it('no muestra modal cuando OKX Wallet está en red correcta', async () => {
    mockIsOKXWallet.mockReturnValue(true)
    // Ya está configurado por defecto con chainId: 42220 (Celo mainnet)

    const { container } = render(<OKXNetworkCheck />)

    // Esperar un ciclo para que se ejecute useEffect
    await waitFor(() => {
      expect(container.firstChild).toBeNull()
    })
  })

  it('no muestra modal cuando no es OKX Wallet (aunque esté en red incorrecta)', async () => {
    mockIsOKXWallet.mockReturnValue(false)
    mockUseAccount.mockReturnValue({
      chainId: 1, // Ethereum mainnet
      address: '0x1234567890123456789012345678901234567890',
      isConnected: true,
      connector: { name: 'MetaMask', id: 'metaMask' },
    })

    const { container } = render(<OKXNetworkCheck />)

    await waitFor(() => {
      expect(container.firstChild).toBeNull()
    })
  })

  // --- Pruebas de interacción --- //

  it('ejecuta switchToCelo cuando se hace clic en "Try Auto-Switch"', async () => {
    // Configurar para mostrar modal
    mockIsOKXWallet.mockReturnValue(true)
    mockUseAccount.mockReturnValue({
      chainId: 1,
      address: '0x1234567890123456789012345678901234567890',
      isConnected: true,
      connector: { name: 'OKX Wallet', id: 'okxWallet' },
    })

    render(<OKXNetworkCheck />)

    // Esperar a que aparezca el modal y los botones
    await screen.findByText(/Wrong Network Detected/i)

    // Encontrar el botón "Try Auto-Switch" (puede tener emoji 🔄)
    const tryButton = await screen.findByRole('button', { name: /Try Auto-Switch/i })
    fireEvent.click(tryButton)

    expect(mockSwitchToCelo).toHaveBeenCalledTimes(1)
  })

  it('cierra modal cuando se hace clic en "I\'ve switched"', async () => {
    mockIsOKXWallet.mockReturnValue(true)
    mockUseAccount.mockReturnValue({
      chainId: 1,
      address: '0x1234567890123456789012345678901234567890',
      isConnected: true,
      connector: { name: 'OKX Wallet', id: 'okxWallet' },
    })

    const { container } = render(<OKXNetworkCheck />)

    await screen.findByText(/Wrong Network Detected/i)

    const switchButton = await screen.findByRole('button', { name: /I've switched/i })
    fireEvent.click(switchButton)

    // El modal debería desaparecer
    await waitFor(() => {
      expect(container.firstChild).toBeNull()
    })
  })

  it('copia diagnósticos al portapapeles cuando se hace clic en "Copy Diagnostics"', async () => {
    mockIsOKXWallet.mockReturnValue(true)
    mockUseAccount.mockReturnValue({
      chainId: 1,
      address: '0x1234567890123456789012345678901234567890',
      isConnected: true,
      connector: { name: 'OKX Wallet', id: 'okxWallet' },
    })
    mockClipboard.writeText.mockResolvedValue(undefined)

    render(<OKXNetworkCheck />)

    await screen.findByText(/Wrong Network Detected/i)

    const copyButton = await screen.findByRole('button', { name: /Copy Diagnostics/i })
    fireEvent.click(copyButton)

    expect(mockClipboard.writeText).toHaveBeenCalledTimes(1)

    // Debería mostrar "Copied!" temporalmente
    await screen.findByText(/Copied!/i)
  })

  it.skip('abre nueva ventana cuando se hace clic en "Open in Chrome"', async () => {
    mockIsOKXWallet.mockReturnValue(true)
    mockUseAccount.mockReturnValue({
      chainId: 1,
      address: '0x1234567890123456789012345678901234567890',
      isConnected: true,
      connector: { name: 'OKX Wallet', id: 'okxWallet' },
    })

    render(<OKXNetworkCheck />)

    await screen.findByText(/Wrong Network Detected/i)

    const openButton = await screen.findByRole('button', { name: /Open in Chrome/i })
    fireEvent.click(openButton)

    expect(window.open).toHaveBeenCalledTimes(1)
    expect(window.open).toHaveBeenCalledWith(window.location.href, '_blank')
  })

  // --- Pruebas de entorno no-producción --- //

  it('usa configuración de testnet cuando IS_PRODUCTION es false', async () => {
    mockConfig.IS_PRODUCTION = false
    mockIsOKXWallet.mockReturnValue(true)
    mockUseAccount.mockReturnValue({
      chainId: 11155111, // Sepolia (red incorrecta para Celo Sepolia)
      address: '0x1234567890123456789012345678901234567890',
      isConnected: true,
      connector: { name: 'OKX Wallet', id: 'okxWallet' },
    })

    render(<OKXNetworkCheck />)

    await waitFor(() => {
      expect(screen.getByText(/Wrong Network Detected/i)).toBeInTheDocument()
    })

    // Debería mencionar "Celo Sepolia" no "Celo"
    expect(screen.getByText(/Celo Sepolia/)).toBeInTheDocument()
  })

  // --- Pruebas de estados de carga --- //

  it.skip('muestra spinner cuando isSwitching es true', async () => {
    mockIsOKXWallet.mockReturnValue(true)
    mockUseAccount.mockReturnValue({
      chainId: 1,
      address: '0x1234567890123456789012345678901234567890',
      isConnected: true,
      connector: { name: 'OKX Wallet', id: 'okxWallet' },
    })

    // Primer intento automático: falla para mostrar modal
    mockSwitchToCelo.mockResolvedValue(false)

    render(<OKXNetworkCheck />)

    // Esperar a que aparezca el modal
    await screen.findByText(/Wrong Network Detected/i)

    // Ahora, cuando el usuario haga clic en "Try Auto-Switch", la promesa nunca se resuelve
    mockSwitchToCelo.mockImplementation(() => new Promise(() => {}))

    // Hacer clic en "Try Auto-Switch" para activar isSwitching
    const tryButton = await screen.findByRole('button', { name: /Try Auto-Switch/i })
    fireEvent.click(tryButton)

    // Debería mostrar spinner
    await screen.findByText(/Switching to Celo network automatically/i)
  })
})