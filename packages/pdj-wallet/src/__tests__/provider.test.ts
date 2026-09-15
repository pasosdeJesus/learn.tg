import { beforeEach, describe, expect, it } from 'vitest'
import { verifyMessage } from 'viem'
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

  it('rejects unsupported methods', async () => {
    await importWallet({ mnemonic: HARDHAT_MNEMONIC, pin: PIN, storage: new MemoryStorage() })
    const provider = getInAppWalletProvider()!
    await expect(provider.request({ method: 'eth_unknownMethod' })).rejects.toThrow(/Unsupported method/)
  })

  it('requires an rpcUrl to broadcast transactions', async () => {
    await importWallet({ mnemonic: HARDHAT_MNEMONIC, pin: PIN, storage: new MemoryStorage() })
    const provider = getInAppWalletProvider()!
    await expect(
      provider.request({ method: 'eth_sendTransaction', params: [{ to: HARDHAT_ADDRESS }] }),
    ).rejects.toThrow(/rpcUrl/)
  })
})
