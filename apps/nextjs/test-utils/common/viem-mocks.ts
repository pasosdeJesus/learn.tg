/**
 * Viem mocking utilities for tests
 *
 * "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)
 */

import { vi } from 'vitest'

// Mock objects defined with vi.hoisted for proper hoisting
const viemMocks = vi.hoisted(() => ({
  createPublicClient: vi.fn(() => ({
    getTransactionReceipt: vi.fn().mockResolvedValue({ status: 'success', blockNumber: 12345n }),
    getBlock: vi.fn().mockResolvedValue({ number: 12347n }),
  })),
  createWalletClient: vi.fn(() => ({
    sendTransaction: vi.fn().mockResolvedValue('0xmocktxhash'),
  })),
  getContract: vi.fn(),
  encodeFunctionData: vi.fn(() => '0xmockEncodedData'),
  http: vi.fn(),
  privateKeyToAccount: vi.fn(),
  formatUnits: vi.fn(),
}))

const viemChainsMocks = vi.hoisted(() => ({
  celo: {},
  celoSepolia: {},
}))

export { viemMocks, viemChainsMocks }

/**
 * Mock for viem module
 */
export function mockViem() {
  return viemMocks
}