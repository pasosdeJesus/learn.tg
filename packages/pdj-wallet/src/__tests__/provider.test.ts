import { beforeEach, describe, expect, it } from 'vitest'
import { verifyMessage } from 'viem'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getInAppWalletProvider } from '../provider'
import { importWallet, lockWallet } from '../wallet'
import { MemoryStorage } from '../storage/memory'
import { CHAIN_IDS } from '../types'

const HARDHAT_MNEMONIC = 'test test test test test test test test test test test junk'
const HARDHAT_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const PIN = '123456'

describe('getInAppWalletProvider', () => {
  beforeEach(async () => {
    await lockWallet()
  })

  it('returns null while the wallet is locked', () => {
    expect(getInAppWalletProvider()).toBeNull()
  })

  it('exposes the address and chain id when unlocked', async () => {
    await importWallet({ mnemonic: HARDHAT_MNEMONIC, pin: PIN, storage: new MemoryStorage() })
    const provider = getInAppWalletProvider()
    expect(provider).not.toBeNull()
    expect(await provider!.request({ method: 'eth_accounts' })).toEqual([HARDHAT_ADDRESS])
    expect(await provider!.request({ method: 'eth_requestAccounts' })).toEqual([HARDHAT_ADDRESS])
    expect(await provider!.request({ method: 'eth_chainId' })).toBe(
      `0x${CHAIN_IDS.celoSepolia.toString(16)}`,
    )
    expect(await provider!.request({ method: 'net_version' })).toBe(String(CHAIN_IDS.celoSepolia))
  })

  it('signs personal_sign payloads with the wallet key', async () => {
    await importWallet({ mnemonic: HARDHAT_MNEMONIC, pin: PIN, storage: new MemoryStorage() })
    const provider = getInAppWalletProvider()!
    const message = 'Sign in to Learn Through Games.'
    const hex = `0x${Array.from(new TextEncoder().encode(message))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`
    const signature = (await provider.request({
      method: 'personal_sign',
      params: [hex, HARDHAT_ADDRESS],
    })) as `0x${string}`
    expect(await verifyMessage({ address: HARDHAT_ADDRESS, message, signature })).toBe(true)
  })

  // 2026-09-19: el provider sólo respondía a los métodos de firma, así que las
  // lecturas de la app (eth_call, eth_getBalance…) fallaban con "Unsupported
  // method" y los modales de donación/pago mostraban saldos en cero.
  it('forwards read methods to the RPC endpoint', async () => {
    await importWallet({ mnemonic: HARDHAT_MNEMONIC, pin: PIN, storage: new MemoryStorage() })
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { body: string }) => {
        const body = JSON.parse(init.body)
        calls.push(body.method)
        return { json: async () => ({ result: body.method === 'eth_getBalance' ? '0x64' : '0x1' }) }
      }),
    )
    try {
      const provider = getInAppWalletProvider({ rpcUrl: 'https://rpc.example' })!
      const balance = await provider.request({
        method: 'eth_getBalance',
        params: [HARDHAT_ADDRESS, 'latest'],
      })
      expect(balance).toBe('0x64')
      const call = await provider.request({
        method: 'eth_call',
        params: [{ to: HARDHAT_ADDRESS, data: '0x' }, 'latest'],
      })
      expect(call).toBe('0x1')
      expect(calls).toEqual(['eth_getBalance', 'eth_call'])
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('explains that a read needs an rpcUrl when the provider has none', async () => {
    await importWallet({ mnemonic: HARDHAT_MNEMONIC, pin: PIN, storage: new MemoryStorage() })
    const provider = getInAppWalletProvider()!
    await expect(provider.request({ method: 'eth_call', params: [] })).rejects.toThrow(/rpcUrl/)
  })

  it('requires an rpcUrl to broadcast transactions', async () => {
    await importWallet({ mnemonic: HARDHAT_MNEMONIC, pin: PIN, storage: new MemoryStorage() })
    const provider = getInAppWalletProvider()!
    await expect(
      provider.request({ method: 'eth_sendTransaction', params: [{ to: HARDHAT_ADDRESS }] }),
    ).rejects.toThrow(/rpcUrl/)
  })
})
