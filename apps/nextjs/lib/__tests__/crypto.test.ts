import { vi, describe, it, expect, beforeEach } from 'vitest'
import { callWriteFun } from '../crypto'

// Mock viem modules
const mockGetTransactionCount = vi.fn()
const mockWaitForTransactionReceipt = vi.fn()

const mockPublicClient = {
  getTransactionCount: mockGetTransactionCount,
  waitForTransactionReceipt: mockWaitForTransactionReceipt,
}

const mockAccount = {
  address: '0x1234567890123456789012345678901234567890',
}

const mockContractFun = vi.fn()

// Mock dotenv/config - no need to do anything
vi.mock('dotenv/config', () => ({}))

// Mock viem
vi.mock('viem', () => ({
  createPublicClient: vi.fn(),
  createWalletClient: vi.fn(),
  getContract: vi.fn(),
  http: vi.fn(),
  formatUnits: vi.fn(),
}))

// Mock viem/accounts
vi.mock('viem/accounts', () => ({
  privateKeyToAccount: vi.fn(),
}))

// Mock JSON import - we need to handle it differently
// Since it's a JSON import with `with { type: 'json' }`, we can mock the whole module
vi.mock('../../abis/LearnTGVaults.json', () => ({ default: [] }))

describe('crypto', () => {
  describe('callWriteFun', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      mockGetTransactionCount.mockResolvedValue(5)
      mockWaitForTransactionReceipt.mockResolvedValue({
        status: 'success',
        transactionHash: '0xhash',
      })
      mockContractFun.mockResolvedValue('0xtransactionhash')
    })

    it('should call contract function and return transaction hash', async () => {
      const result = await callWriteFun(
        mockPublicClient as any,
        mockAccount as any,
        mockContractFun as any,
        ['param1', 'param2'],
        0
      )

      expect(mockContractFun).toHaveBeenCalledWith(['param1', 'param2'])
      expect(result).toBe('0xtransactionhash')
      expect(mockWaitForTransactionReceipt).toHaveBeenCalledWith({
        hash: '0xtransactionhash',
        confirmations: 2,
        timeout: 3000,
      })
    })

    it('should retry with nonce when first call fails', async () => {
      mockContractFun
        .mockRejectedValueOnce(new Error('some error'))
        .mockResolvedValueOnce('0xretryhash')

      const result = await callWriteFun(
        mockPublicClient as any,
        mockAccount as any,
        mockContractFun as any,
        ['param1'],
        0
      )

      // First call fails
      expect(mockContractFun).toHaveBeenCalledTimes(2)
      // Second call should have nonce option
      expect(mockContractFun).toHaveBeenLastCalledWith(['param1'], {
        account: mockAccount,
        nonce: 6, // nonce + 1
      })
      expect(result).toBe('0xretryhash')
      expect(mockGetTransactionCount).toHaveBeenCalledWith({
        address: mockAccount.address,
        blockTag: 'pending',
      })
    })

    it('should continue even if waitForTransactionReceipt fails', async () => {
      mockWaitForTransactionReceipt.mockRejectedValue(new Error('timeout'))

      const result = await callWriteFun(
        mockPublicClient as any,
        mockAccount as any,
        mockContractFun as any,
        [],
        0
      )

      expect(result).toBe('0xtransactionhash')
      // waitForTransactionReceipt should still have been called
      expect(mockWaitForTransactionReceipt).toHaveBeenCalled()
    })

    it('should log with indent when provided', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await callWriteFun(
        mockPublicClient as any,
        mockAccount as any,
        mockContractFun as any,
        ['test'],
        2
      )

      expect(consoleLogSpy).toHaveBeenNthCalledWith(1,
        ' ',
        'Calling function',
        'spy',
        'with params',
        ['test']
      )

      consoleLogSpy.mockRestore()
    })
  })
})