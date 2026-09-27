// @vitest-environment node
/**
 * Prueba de integración del defecto reportado por el operador el 2026-09-27: al pagar el
 * curso GD en producción con una billetera in-app creada en el sitio de desarrollo, viem
 * cortaba con `ChainMismatchError` ("The current chain of the wallet (id: 11142220) does
 * not match the target chain for the transaction (id: 42220 – Celo)").
 *
 * Causa: la billetera in-app quedaba atada a la red con la que se creó y su
 * `wallet_switchEthereumChain` respondía 4902. Aquí se recorre el camino real — un
 * cliente viem de Celo sobre el proveedor de la billetera creada en Celo Sepolia — con
 * las dos piezas juntas: el proveedor (que ahora cambia de red) y el pre-flight
 * (`ensureWalletChain`) que usan los modales de pago.
 *
 * `@vitest-environment node`: la billetera cifra con WebCrypto y el entorno jsdom por
 * defecto no lo expone.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { createWalletClient, custom } from 'viem'
import { celo } from 'viem/chains'
import { getInAppWalletProvider, getWalletInfo, importWallet, lockWallet } from '@learn-tg/pdj-wallet'
import { MemoryStorage } from '@learn-tg/pdj-wallet'
import { ensureWalletChain } from '@/lib/ensure-chain'

const HARDHAT_MNEMONIC = 'test test test test test test test test test test test junk'
const HARDHAT_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const password = '12345678'

describe('pre-flight de red con la billetera in-app', () => {
  afterEach(async () => {
    await lockWallet()
  })

  it('una billetera creada en Celo Sepolia termina pagando en Celo', async () => {
    const storage = new MemoryStorage()
    const created = await importWallet({ mnemonic: HARDHAT_MNEMONIC, password, storage })
    expect(created.chain).toBe('celoSepolia')

    const provider = getInAppWalletProvider({ storage })
    expect(provider).not.toBeNull()
    const walletClient = createWalletClient({
      account: HARDHAT_ADDRESS,
      chain: celo,
      transport: custom(provider as never),
    })

    // Antes del cambio la billetera declara la red del sitio de desarrollo.
    expect(await walletClient.getChainId()).toBe(11142220)

    await ensureWalletChain(walletClient as never, celo, provider)

    // Ya no hay desajuste: es lo que viem compara en `assertCurrentChain` al firmar.
    expect(await walletClient.getChainId()).toBe(celo.id)
    expect((await getWalletInfo(storage))?.chain).toBe('celo')
  })

  it('avisa `chainChanged` para que la app sepa que la red cambió', async () => {
    const storage = new MemoryStorage()
    await importWallet({ mnemonic: HARDHAT_MNEMONIC, password, storage })
    const provider = getInAppWalletProvider({ storage })!
    const seen: unknown[] = []
    provider.on?.('chainChanged', (payload) => seen.push(payload))

    const walletClient = createWalletClient({
      account: HARDHAT_ADDRESS,
      chain: celo,
      transport: custom(provider as never),
    })
    await ensureWalletChain(walletClient as never, celo, provider)

    expect(seen).toEqual([`0x${celo.id.toString(16)}`])
  })
})
