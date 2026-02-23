/**
 * Switch to Celo network for OKX Wallet
 *
 * "Todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres"
 * - Colosenses 3:23
 *
 * This function attempts to switch OKX Wallet to the correct Celo network
 * (mainnet or testnet) based on the current environment.
 */

import { IS_PRODUCTION } from './config'

interface WindowWithOKX extends Window {
  okxwallet?: {
    request: (args: { method: string; params?: any[] }) => Promise<any>
  }
  ethereum?: {
    isOKX?: boolean
    isOkxWallet?: boolean
    request?: (args: { method: string; params?: any[] }) => Promise<any>
    [key: string]: any
  }
  okex?: {
    request: (args: { method: string; params?: any[] }) => Promise<any>
  }
}

/**
 * Detect OKX Wallet provider
 * @returns The detected provider or undefined
 */
function detectOKXProvider(): { provider: any; detectionMethod: string } | undefined {
  const win = window as WindowWithOKX

  // Check multiple possible OKX provider locations
  if (win.okxwallet?.request) {
    return { provider: win.okxwallet, detectionMethod: 'window.okxwallet' }
  }
  if (win.ethereum?.isOKX || win.ethereum?.isOkxWallet) {
    return { provider: win.ethereum, detectionMethod: 'window.ethereum.isOKX/isOkxWallet' }
  }
  if (win.okex?.request) {
    return { provider: win.okex, detectionMethod: 'window.okex' }
  }

  // Check user agent for OKX browser
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('okx') || ua.includes('web3wallet') || ua.includes('okex')) {
    if (win.ethereum?.request) {
      return { provider: win.ethereum, detectionMethod: 'userAgent + window.ethereum' }
    }
  }

  return undefined
}

/**
 * Get current chain ID from provider
 */
async function getCurrentChainId(provider: any): Promise<string | undefined> {
  try {
    const chainId = await provider.request({ method: 'eth_chainId' })
    return chainId
  } catch (error) {
    console.warn('Could not get current chainId:', error)
    return undefined
  }
}

/**
 * Check if already on correct network
 */
function isCorrectNetwork(currentChainId: string): boolean {
  const expectedChainId = IS_PRODUCTION ? '0xa4ec' : '0xaa0b4c' // 42220 or 11142220 in hex
  return currentChainId?.toLowerCase() === expectedChainId.toLowerCase()
}

/**
 * Switch OKX Wallet to Celo network
 * @returns Promise<boolean> - true if successful or already on correct network
 */
export async function switchToCelo(): Promise<boolean> {
  console.log('=== switchToCelo() called ===')
  console.log('IS_PRODUCTION:', IS_PRODUCTION)

  // 1. Detect OKX provider
  const detection = detectOKXProvider()
  if (!detection) {
    console.log('No OKX Wallet detected. User may be using a different wallet.')
    return false // Not an error, just not OKX
  }

  const { provider, detectionMethod } = detection
  console.log('OKX detected via:', detectionMethod)
  console.log('Provider:', provider)

  // 2. Get current chain ID
  const currentChainId = await getCurrentChainId(provider)
  console.log('Current chainId:', currentChainId)

  // 3. Check if already on correct network
  if (currentChainId && isCorrectNetwork(currentChainId)) {
    console.log('Already on correct Celo network')
    return true
  }

  // 4. Determine target network configuration
  const expectedChainId = IS_PRODUCTION ? '0xa4ec' : '0xaa0b4c'
  const networkConfig = IS_PRODUCTION
    ? {
        chainId: expectedChainId,
        chainName: 'Celo',
        nativeCurrency: {
          name: 'CELO',
          symbol: 'CELO',
          decimals: 18,
        },
        rpcUrls: ['https://forno.celo.org'],
        blockExplorerUrls: ['https://celoscan.io'],
      }
    : {
        chainId: expectedChainId,
        chainName: 'Celo Sepolia',
        nativeCurrency: {
          name: 'CELO',
          symbol: 'CELO',
          decimals: 18,
        },
        rpcUrls: ['https://sepolia-forno.celo-testnet.org'],
        blockExplorerUrls: ['https://celo-sepolia.blockscout.com/'],
      }

  // 5. Try to switch network
  try {
    console.log('Attempting to switch to Celo network...')
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: expectedChainId }],
    })
    console.log('✅ Successfully switched to Celo network')

    // Record success event
    await recordSwitchEvent('success', detectionMethod, expectedChainId)
    return true
  } catch (switchError: any) {
    console.log('Switch error:', switchError)

    // 6. If network not added (error 4902), add it
    if (switchError.code === 4902) {
      console.log('Celo network not found in wallet, adding it...')
      try {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [networkConfig],
        })
        console.log('✅ Successfully added Celo network')

        // Record add event
        await recordSwitchEvent('added', detectionMethod, expectedChainId)
        return true
      } catch (addError: any) {
        console.error('Failed to add Celo network:', addError)

        // Record failure
        await recordSwitchEvent('add_failed', detectionMethod, expectedChainId, addError.message)
        return false
      }
    } else {
      console.error('Failed to switch network:', switchError)

      // Record failure
      await recordSwitchEvent('switch_failed', detectionMethod, expectedChainId, switchError.message)
      return false
    }
  }
}

/**
 * Record switch event to userevent table for monitoring
 */
async function recordSwitchEvent(
  eventType: 'success' | 'added' | 'switch_failed' | 'add_failed',
  detectionMethod: string,
  expectedChainId: string,
  errorMessage?: string
): Promise<void> {
  // Log to console only for now
  console.log(`[OKX Switch] ${eventType}`, {
    detectionMethod,
    expectedChainId,
    errorMessage,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Check if user is on OKX Wallet (any version)
 */
export function isOKXWallet(): boolean {
  return detectOKXProvider() !== undefined
}

/**
 * Check if user is on correct network (for any wallet, not just OKX)
 */
export async function isOnCorrectNetwork(): Promise<boolean> {
  const win = window as WindowWithOKX
  const provider = win.ethereum || win.okxwallet || win.okex

  if (!provider?.request) {
    return false
  }

  try {
    const currentChainId = await getCurrentChainId(provider)
    return currentChainId ? isCorrectNetwork(currentChainId) : false
  } catch (error) {
    console.warn('Could not check network:', error)
    return false
  }
}