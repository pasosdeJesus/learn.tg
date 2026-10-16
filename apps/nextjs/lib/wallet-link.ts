'use client'

import { SiweMessage } from 'siwe'
import { getAddress } from 'viem'
import type { Eip1193Provider } from '@pasosdejesus/m/wallet'
import { getAppChain } from '@/lib/app-chain'
import { linkAccountWallet, type LinkResult } from '@/lib/wallet-account'

/**
 * Enlace de una segunda billetera firmado por la **billetera activa** (R-#265 §3.2).
 *
 * Decisión del operador (2026-10-15): no hay un selector de billetera para el SIWE; firma
 * la billetera **activa**. En orden:
 *
 * 1. la **de la aplicación**, si está desbloqueada y **no** es la de la sesión (así no se
 *    le pide permiso a ninguna extensión cuando el caso ya está resuelto);
 * 2. si no, la **externa** (OneKey, MetaMask, Rabby… vía EIP-6963 / `window.ethereum`).
 *    Si el sitio todavía no tiene permiso sobre ella, se pide con `eth_requestAccounts`:
 *    es exactamente lo que el usuario espera al pulsar "Vincular" con la extensión recién
 *    activada (activar la extensión no concede acceso al sitio);
 * 3. la billetera de la sesión no sirve como firmante (ya está en la cuenta).
 */

export interface ActiveWalletSigner {
  address: string
  provider: Eip1193Provider
}

export type ActiveWalletFailure = 'no-wallet' | 'is-session-wallet' | 'cancelled'

export type ActiveWalletResolution =
  | { ok: true; signer: ActiveWalletSigner }
  | { ok: false; reason: ActiveWalletFailure }

/**
 * Cuentas de la billetera externa. `eth_accounts` devuelve `[]` mientras el sitio no tenga
 * permiso, así que hace falta `eth_requestAccounts` (el prompt de la extensión).
 */
async function externalAccounts(provider: Eip1193Provider): Promise<{ accounts: string[]; cancelled: boolean }> {
  try {
    const current = (await provider.request({ method: 'eth_accounts' })) as string[]
    if (Array.isArray(current) && current.length > 0) return { accounts: current, cancelled: false }
  } catch {
    // Un proveedor que no responde a `eth_accounts` todavía puede responder al pedido.
  }
  try {
    const requested = (await provider.request({ method: 'eth_requestAccounts' })) as string[]
    return { accounts: Array.isArray(requested) ? requested : [], cancelled: false }
  } catch (error) {
    const code = (error as { code?: number })?.code
    const message = String((error as Error)?.message ?? error)
    return { accounts: [], cancelled: code === 4001 || /reject|denied|cancel/i.test(message) }
  }
}

/** Elige la billetera activa que puede firmar el enlace (ver el bloque de arriba). */
export async function detectActiveWalletSigner(input: {
  inAppUnlocked: boolean
  inAppAddress?: string | null
  inAppProvider?: Eip1193Provider | null
  externalProvider?: Eip1193Provider | null
  sessionAddress?: string | null
}): Promise<ActiveWalletResolution> {
  const session = (input.sessionAddress || '').toLowerCase()
  const hasInApp = !!(input.inAppUnlocked && input.inAppAddress && input.inAppProvider)

  // 1. La billetera de la aplicación desbloqueada, si no es la de la sesión.
  if (hasInApp && input.inAppAddress!.toLowerCase() !== session) {
    return { ok: true, signer: { address: input.inAppAddress!, provider: input.inAppProvider! } }
  }

  // 2. La externa; se pide conexión si el sitio aún no tiene permiso.
  if (input.externalProvider) {
    const { accounts, cancelled } = await externalAccounts(input.externalProvider)
    const account = accounts[0]
    if (account) {
      return account.toLowerCase() === session
        ? { ok: false, reason: 'is-session-wallet' }
        : { ok: true, signer: { address: account, provider: input.externalProvider } }
    }
    return { ok: false, reason: cancelled ? 'cancelled' : 'no-wallet' }
  }

  // 3. Sin externa: si hay una de la aplicación desbloqueada, es la de la sesión.
  if (hasInApp) return { ok: false, reason: 'is-session-wallet' }
  return { ok: false, reason: 'no-wallet' }
}

export type LinkActiveResult = LinkResult | { ok: false; reason: 'cancelled' }

/**
 * Firma (SIWE) con la billetera activa y pide el enlace a la cuenta de la sesión. El
 * `nonce` es el `csrfToken` de NextAuth, igual que en el inicio de sesión; el servidor
 * verifica dominio, red y nonce antes de llamar al motor `wallet`.
 */
export async function linkActiveWallet(args: {
  signer: ActiveWalletSigner
  sessionWallet: string
}): Promise<LinkActiveResult> {
  let csrfToken: string | undefined
  try {
    csrfToken = (await (await fetch('/api/auth/csrf')).json())?.csrfToken
  } catch {
    csrfToken = undefined
  }
  if (!csrfToken) return { ok: false, reason: 'error' }

  const message = new SiweMessage({
    domain: window.location.host,
    address: getAddress(args.signer.address),
    statement: 'Link this wallet to my Learn account.',
    uri: window.location.origin,
    version: '1',
    chainId: getAppChain().id,
    nonce: csrfToken,
  }).prepareMessage()

  let signature: string
  try {
    signature = (await args.signer.provider.request({
      method: 'personal_sign',
      params: [message, args.signer.address],
    })) as string
  } catch {
    // Rechazo del usuario en la billetera (EIP-1193: code 4001) u otro fallo de firma.
    return { ok: false, reason: 'cancelled' }
  }

  return linkAccountWallet({ walletAddress: args.sessionWallet, message, signature })
}
