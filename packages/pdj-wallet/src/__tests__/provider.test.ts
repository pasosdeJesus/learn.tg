import { beforeEach, describe, expect, it } from 'vitest'
import { verifyMessage } from 'viem'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { extractDestination, getInAppWalletProvider } from '../provider'
import { currentLockEpoch, importWallet, lockWallet } from '../wallet'
import { MemoryStorage } from '../storage/memory'
import { CHAIN_IDS } from '../types'

const HARDHAT_MNEMONIC = 'test test test test test test test test test test test junk'
const HARDHAT_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const password = '12345678'

describe('getInAppWalletProvider', () => {
  beforeEach(async () => {
    await lockWallet()
  })

  it('returns null while the wallet is locked', () => {
    expect(getInAppWalletProvider()).toBeNull()
  })

  it('exposes the address and chain id when unlocked', async () => {
    await importWallet({ mnemonic: HARDHAT_MNEMONIC, password: password, storage: new MemoryStorage() })
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
    await importWallet({ mnemonic: HARDHAT_MNEMONIC, password: password, storage: new MemoryStorage() })
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
    await importWallet({ mnemonic: HARDHAT_MNEMONIC, password: password, storage: new MemoryStorage() })
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
    await importWallet({ mnemonic: HARDHAT_MNEMONIC, password: password, storage: new MemoryStorage() })
    const provider = getInAppWalletProvider()!
    await expect(provider.request({ method: 'eth_call', params: [] })).rejects.toThrow(/rpcUrl/)
  })

  it('requires an rpcUrl to broadcast transactions', async () => {
    await importWallet({ mnemonic: HARDHAT_MNEMONIC, password: password, storage: new MemoryStorage() })
    const provider = getInAppWalletProvider()!
    await expect(
      provider.request({ method: 'eth_sendTransaction', params: [{ to: HARDHAT_ADDRESS }] }),
    ).rejects.toThrow(/rpcUrl/)
  })

  // R-#253: el destino es `to` (nativo) o el destinatario dentro del calldata ERC-20.
  it('extracts the destination of a native transfer', () => {
    expect(extractDestination({ to: HARDHAT_ADDRESS })).toBe(HARDHAT_ADDRESS)
  })

  it('extracts the recipient of an ERC-20 transfer', () => {
    const recipient = '11'.repeat(20)
    const data = `0xa9059cbb${'0'.repeat(24)}${recipient}${'0'.repeat(64)}`
    expect(extractDestination({ to: '0xtoken', data })).toBe(`0x${recipient}`)
  })

  it('extracts the recipient of transferFrom (second argument)', () => {
    const recipient = '22'.repeat(20)
    const data = `0x23b872dd${'0'.repeat(64)}${'0'.repeat(24)}${recipient}${'0'.repeat(64)}`
    expect(extractDestination({ to: '0xtoken', data })).toBe(`0x${recipient}`)
  })

  // 2026-09-20: viem delega `eth_sendTransaction` al wallet sin rellenar gas/fees/
  // nonce para cuentas JSON-RPC, y la cuenta local no puede inferir el tipo sin
  // ellos ("Cannot infer a transaction type…"). El provider los rellena por RPC.
  it('fills nonce, gas and fees before signing a native send', async () => {
    await importWallet({ mnemonic: HARDHAT_MNEMONIC, password: password, storage: new MemoryStorage() })
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { body: string }) => {
        const body = JSON.parse(init.body)
        calls.push(body.method)
        const results: Record<string, unknown> = {
          eth_chainId: '0xaa37cc',
          eth_getTransactionCount: '0x0',
          eth_estimateGas: '0x5208',
          eth_gasPrice: '0x1',
          eth_sendRawTransaction: '0xhash',
        }
        return { json: async () => ({ result: results[body.method] }) }
      }),
    )
    try {
      const provider = getInAppWalletProvider({
        rpcUrl: 'https://rpc.example',
        requireUserVerification: false,
      })!
      const hash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: HARDHAT_ADDRESS, to: HARDHAT_ADDRESS, value: '0x1' }],
      })
      expect(hash).toBe('0xhash')
      expect(calls).toContain('eth_getTransactionCount')
      expect(calls).toContain('eth_estimateGas')
      expect(calls).toContain('eth_gasPrice')
      expect(calls).toContain('eth_sendRawTransaction')
    } finally {
      vi.unstubAllGlobals()
    }
  })
  // R-#236: la billetera de la aplicación se ata a una red al crearla, así que no
  // puede cambiar de cadena. Antes devolvía `null` (éxito) sin cambiar nada y el
  // llamador creía que había cambiado.
  it('wallet_switchEthereumChain accepts its own chain and rejects another', async () => {
    await importWallet({ mnemonic: HARDHAT_MNEMONIC, password: password, storage: new MemoryStorage() })
    const provider = getInAppWalletProvider()!
    const own = `0x${CHAIN_IDS.celoSepolia.toString(16)}`
    expect(
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: own }] }),
    ).toBeNull()
    await expect(
      provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x1' }] }),
    ).rejects.toMatchObject({ code: 4902 })
  })

  // R-#246 §14 item 3: la generación de bloqueo sube al bloquear o borrar, y el
  // proveedor la compara alrededor del gesto (assertStillUnlocked).
  it('bumps the lock generation when the wallet locks', async () => {
    await importWallet({ mnemonic: HARDHAT_MNEMONIC, password: password, storage: new MemoryStorage() })
    const before = currentLockEpoch()
    await lockWallet()
    expect(currentLockEpoch()).toBe(before + 1)
  })
})
