import { getUnlockedAccount, getUnlockedInfo, currentLockEpoch, signMessage, signTransaction, signTypedData } from './wallet.js'
import { isKnownDestination, rememberDestination } from './destinations.js'
import { readBiometricRecord } from './biometric.js'
import { assertUserVerification, hasRecentUserVerification, isUserCancelledError } from './web-authn.js'
import { CHAIN_IDS, type Eip1193Provider, type Eip1193RequestArgs } from './types.js'

/**
 * Event registry of the in-app provider (R-#236). The provider object is created
 * on demand (`getInAppWalletProvider()` returns null while locked), so the registry
 * lives at module level: a dapp that subscribed before a lock still gets the notice.
 *
 * `accountsChanged` fires with `[]` when a request finds the wallet locked or
 * deleted; `chainChanged` never fires because the wallet is bound to one chain at
 * creation (that is what `wallet_switchEthereumChain` answers with 4902).
 */
type ProviderListener = (payload: unknown) => void
const listeners = new Map<string, Set<ProviderListener>>()

function emit(event: string, payload?: unknown): void {
  for (const listener of listeners.get(event) ?? []) {
    try {
      listener(payload)
    } catch {
      // un listener roto no puede tumbar la billetera
    }
  }
}

/** Dapps that subscribed: the wallet left the session (lock or delete). */
export function emitAccountsChanged(accounts: string[]): void {
  emit('accountsChanged', accounts)
  if (accounts.length === 0) emit('disconnect', { code: 4900, message: 'The in-app wallet locked' })
}

export interface ProviderOptions {
  rpcUrl?: string
  /**
   * Layer L1 of https://github.com/pasosdeJesus/learn.tg/issues/246: before an
   * `eth_sendTransaction` (money leaving the wallet), ask the device to verify the
   * user. On by default when a passkey is enrolled; set to `false` in tests.
   */
  requireUserVerification?: boolean
}

/** Error shape wallets use for "the user rejected the request". */
function userRejected(): Error {
  return Object.assign(new Error('User rejected the request'), { code: 4001 })
}

/**
 * R-#246 §14 item 3: a signature approved before the wallet locked must not go
 * through after. The lock bumps a generation and signing checks it around the
 * gesture.
 */
function assertStillUnlocked(epoch: number): void {
  if (currentLockEpoch() === epoch) return
  // R-#236: avisar a quien esté suscrito, además de abortar la firma.
  emitAccountsChanged([])
  throw userRejected()
}

const ERC20_TRANSFER = '0xa9059cbb'
const ERC20_TRANSFER_FROM = '0x23b872dd'

/**
 * Recipient of a transfer (R-#253): `tx.to` for a native transfer, or the address
 * argument of an ERC-20 `transfer(address,uint256)` / `transferFrom(address,address,uint256)`
 * (that is where USDT/G$/XAUT put the recipient; `to` is the token contract).
 */
export function extractDestination(tx: Record<string, unknown>): string | undefined {
  const to = typeof tx.to === 'string' ? tx.to : undefined
  const data = typeof tx.data === 'string' ? tx.data : undefined
  if (!data || data.length < 10) return to
  const selector = data.slice(0, 10).toLowerCase()
  const body = data.slice(10)
  const argument = (index: number): string | undefined => {
    const chunk = body.slice(index * 64, (index + 1) * 64)
    return chunk.length === 64 ? `0x${chunk.slice(24)}` : undefined
  }
  if (selector === ERC20_TRANSFER) return argument(0) ?? to
  if (selector === ERC20_TRANSFER_FROM) return argument(1) ?? to
  return to
}

/**
 * Fresh user-verified assertion before moving funds (L1). Silently allows the
 * request on devices without a platform authenticator — no passkey enrolled, or a
 * wallet WebView without WebAuthn: L1 needs hardware and must not block the
 * wallet. A cancelled prompt is a rejection (`4001`), like any wallet.
 *
 * R-#253: `destination` (when known) decides whether the grace window applies. A
 * **new** destination always asks for the gesture.
 */
export async function requireFundsConfirmation(
  { destination }: { destination?: string } = {},
): Promise<void> {
  const sealed = await readBiometricRecord().catch(() => null)
  if (!sealed) return
  const wallet = getUnlockedInfo()?.address
  const newDestination = !!(wallet && destination && !isKnownDestination(wallet, destination))
  // Ventana de gracia (R-#253, 15 min): un destino ya conocido no vuelve a pedir el
  // gesto dentro de la ventana; uno nuevo lo exige siempre.
  if (!newDestination && hasRecentUserVerification()) return
  try {
    await assertUserVerification(sealed.credentialId)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message === 'no-webauthn') return
    // R-#246 §14 item 4: la cancelación se detecta por nombre/mensaje (`AbortError`,
    // `cancel*`) y no sólo por `NotAllowedError`; para el llamador EIP-1193 todo
    // termina en el mismo 4001.
    void isUserCancelledError(error)
    throw userRejected()
  }
}

function utf8ToHex(value: string): `0x${string}` {
  let hex = ''
  for (const byte of new TextEncoder().encode(value)) hex += byte.toString(16).padStart(2, '0')
  return `0x${hex}`
}

/**
 * Anything the wallet does not own (reads: `eth_call`, `eth_getBalance`,
 * `eth_gasPrice`, `eth_estimateGas`, `eth_blockNumber`, receipt lookups…) is
 * forwarded to the RPC endpoint. Without this the provider only answered the
 * signing methods, so a page that used the in-app wallet could not read a balance
 * or estimate gas ("Unsupported method: eth_call", reported 2026-09-19).
 */
async function forwardToRpc(
  rpcUrl: string | undefined,
  method: string,
  params: unknown,
): Promise<unknown> {
  if (!rpcUrl) {
    throw new Error(
      `The in-app wallet cannot answer "${method}": it was created without an rpcUrl`,
    )
  }
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params: params ?? [] }),
  })
  const json = (await response.json()) as {
    result?: unknown
    error?: { message?: string; code?: number }
  }
  if (json.error) throw new Error(json.error.message ?? `${method} failed`)
  return json.result
}

/**
 * Fills the fields a local account needs to sign. viem's `sendTransaction`
 * delegates `eth_sendTransaction` to the wallet for JSON-RPC accounts **without**
 * filling fees/gas/nonce, and a local account cannot infer the transaction type
 * without them: it throws "Cannot infer a transaction type from provided
 * transaction." (reported 2026-09-20 donating CELO/G$/XAUT with the in-app wallet).
 */
async function fillTransaction(
  rpcUrl: string | undefined,
  tx: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const hasType = tx.type !== undefined
  const hasFees = tx.gasPrice !== undefined || tx.maxFeePerGas !== undefined
  if (hasType || hasFees) return tx
  if (!rpcUrl) {
    throw new Error('eth_sendTransaction requires the provider to be created with an rpcUrl')
  }
  const filled: Record<string, unknown> = { ...tx }
  const chainIdHex = (await forwardToRpc(rpcUrl, 'eth_chainId', [])) as string
  filled.chainId = Number(chainIdHex)
  const nonceHex = (await forwardToRpc(rpcUrl, 'eth_getTransactionCount', [
    filled.from,
    'pending',
  ])) as string
  filled.nonce = BigInt(nonceHex)
  const gasHex = (await forwardToRpc(rpcUrl, 'eth_estimateGas', [
    { from: filled.from, to: filled.to, value: filled.value, data: filled.data },
  ])) as string
  filled.gas = BigInt(gasHex)
  const gasPriceHex = (await forwardToRpc(rpcUrl, 'eth_gasPrice', [])) as string
  filled.gasPrice = BigInt(gasPriceHex)
  filled.type = 'legacy'
  return filled
}

export function getInAppWalletProvider(options: ProviderOptions = {}): Eip1193Provider | null {
  const account = getUnlockedAccount()
  const info = getUnlockedInfo()
  if (!account || !info) return null

  const provider: Eip1193Provider = {
    isPdJWallet: true,

    async request({ method, params }: Eip1193RequestArgs): Promise<unknown> {
      switch (method) {
        case 'eth_requestAccounts':
        case 'eth_accounts':
          return [account.address]

        case 'eth_chainId':
          return `0x${CHAIN_IDS[info.chain].toString(16)}`

        case 'net_version':
          return String(CHAIN_IDS[info.chain])

        case 'wallet_switchEthereumChain': {
          const [target] = (params ?? []) as [{ chainId?: string }]
          const requested = Number.parseInt(String(target?.chainId ?? ''), 16)
          const current = CHAIN_IDS[info.chain]
          if (requested === current) return null
          // R-#236: la billetera de la aplicación se ata a una red al crearla, así
          // que no puede cambiar de cadena. Devolver `null` sin cambiar engañaba al
          // llamador; EIP-1193 usa 4902 para "cadena desconocida".
          throw Object.assign(
            new Error(
              `Unrecognized chain ID ${String(target?.chainId)}. The in-app wallet is fixed to chain ${current}.`,
            ),
            { code: 4902 },
          )
        }

        case 'personal_sign': {
          const [data] = (params ?? []) as [string, string]
          if (typeof data !== 'string') throw new Error('personal_sign expects a data string')
          return signMessage({ raw: data.startsWith('0x') ? (data as `0x${string}`) : utf8ToHex(data) })
        }

        case 'eth_signTypedData_v4': {
          const [, json] = (params ?? []) as [string, string]
          // R-#246 (L1): una firma EIP-712 también mueve fondos (permiso EIP-2612,
          // `TransferWithAuthorization` EIP-3009 de USDC): mismo gesto fresco.
          const epoch = currentLockEpoch()
          if (options.requireUserVerification !== false) {
            await requireFundsConfirmation()
          }
          assertStillUnlocked(epoch)
          return signTypedData(JSON.parse(json) as never)
        }

        case 'eth_signTransaction': {
          const [tx] = (params ?? []) as [Record<string, unknown>]
          // R-#246 (L1): firma cruda que el llamador puede transmitir después.
          const epoch = currentLockEpoch()
          if (options.requireUserVerification !== false) {
            await requireFundsConfirmation()
          }
          assertStillUnlocked(epoch)
          const filled = options.rpcUrl ? await fillTransaction(options.rpcUrl, tx) : tx
          return signTransaction(filled as never)
        }

        case 'eth_sendTransaction': {
          const [tx] = (params ?? []) as [Record<string, unknown>]
          // El chequeo va antes del gesto: no tiene sentido pedir la huella si no
          // hay a dónde transmitir.
          if (!options.rpcUrl) {
            throw new Error('eth_sendTransaction requires the provider to be created with an rpcUrl')
          }
          const destination = extractDestination(tx)
          // R-#246/R-#253: mover fondos exige verificación; un destino nuevo siempre.
          const epoch = currentLockEpoch()
          if (options.requireUserVerification !== false) {
            await requireFundsConfirmation({ destination })
          }
          assertStillUnlocked(epoch)
          const filled = await fillTransaction(options.rpcUrl, tx)
          const raw = await signTransaction(filled as never)
          // R-#246 §14 item 3: si la billetera se bloqueó mientras se completaba la
          // transacción, no se transmite nada.
          assertStillUnlocked(epoch)
          const hash = await forwardToRpc(options.rpcUrl, 'eth_sendRawTransaction', [raw])
          // Se recuerda sólo tras transmitir: la próxima vez a esa dirección no
          // vuelve a pedir el gesto dentro de la ventana.
          if (destination && info.address) rememberDestination(info.address, destination)
          return hash
        }

        case 'wallet_getCapabilities':
          return {}

        default:
          // Lecturas y métodos que no son de firma van al RPC (ver forwardToRpc).
          return forwardToRpc(options.rpcUrl, method, params)
      }
    },

    // EIP-1193: `on` returns the provider so calls can be chained.
    on(event: string, listener: ProviderListener): Eip1193Provider {
      const set = listeners.get(event) ?? new Set<ProviderListener>()
      set.add(listener)
      listeners.set(event, set)
      return provider
    },

    removeListener(event: string, listener: ProviderListener): Eip1193Provider {
      listeners.get(event)?.delete(listener)
      return provider
    },
  }

  return provider
}
