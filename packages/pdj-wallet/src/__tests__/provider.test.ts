import { beforeEach, describe, expect, it } from 'vitest'
import { verifyMessage } from 'viem'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { extractDestination, getInAppWalletProvider } from '../provider'
import { currentLockEpoch, getWalletInfo, importWallet, lockWallet } from '../wallet'
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
  // 2026-09-27 (reporte del operador): una billetera creada en Celo Sepolia no podía
  // pagar en Celo porque `wallet_switchEthereumChain` respondía 4902 (R-#236 la ataba a
  // la red de creación). La llave sirve en cualquier red: el cambio se aplica, se avisa
  // `chainChanged` y `eth_chainId` responde la red nueva (viem lee ahí para su
  // `assertCurrentChain`, así que sin eso el pago volvía a fallar con ChainMismatchError).
  it('wallet_switchEthereumChain switches to the other known chain and emits chainChanged', async () => {
    const storage = new MemoryStorage()
    await importWallet({ mnemonic: HARDHAT_MNEMONIC, password: password, storage })
    const provider = getInAppWalletProvider({ storage })!
    const changes: unknown[] = []
    provider.on('chainChanged', (payload) => changes.push(payload))
    const celoHex = `0x${CHAIN_IDS.celo.toString(16)}`

    expect(
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: celoHex }] }),
    ).toBeNull()
    expect(await provider.request({ method: 'eth_chainId' })).toBe(celoHex)
    expect(await provider.request({ method: 'net_version' })).toBe(String(CHAIN_IDS.celo))
    expect(changes).toEqual([celoHex])
    expect((await getWalletInfo(storage))?.chain).toBe('celo')
  })

  it('returns null when asked for the chain it is already on, without emitting', async () => {
    const storage = new MemoryStorage()
    await importWallet({ mnemonic: HARDHAT_MNEMONIC, password: password, storage })
    const provider = getInAppWalletProvider({ storage })!
    const changes: unknown[] = []
    provider.on('chainChanged', (payload) => changes.push(payload))

    expect(
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${CHAIN_IDS.celoSepolia.toString(16)}` }],
      }),
    ).toBeNull()
    expect(changes).toEqual([])
  })

  it('wallet_switchEthereumChain rejects an unknown chain with 4902', async () => {
    const storage = new MemoryStorage()
    await importWallet({ mnemonic: HARDHAT_MNEMONIC, password: password, storage })
    const provider = getInAppWalletProvider({ storage })!
    await expect(
      provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x1' }] }),
    ).rejects.toMatchObject({ code: 4902 })
  })

  it('wallet_addEthereumChain accepts the known chains and rejects another', async () => {
    const storage = new MemoryStorage()
    await importWallet({ mnemonic: HARDHAT_MNEMONIC, password: password, storage })
    const provider = getInAppWalletProvider({ storage })!
    expect(
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [{ chainId: `0x${CHAIN_IDS.celo.toString(16)}` }],
      }),
    ).toBeNull()
    await expect(
      provider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: '0x1' }] }),
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
