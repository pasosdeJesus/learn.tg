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
 * la billetera **activa**, es decir la que el usuario tiene conectada en este momento: la
 * de la aplicación si está desbloqueada y, si no, la externa (EIP-6963 /
 * `window.ethereum`). La de la sesión no sirve como firmante (ya está en la cuenta): para
 * enlazar algo nuevo, la billetera activa debe ser **otra**.
 */

export interface ActiveWalletSigner {
  address: string
  provider: Eip1193Provider
}

export type ActiveWalletFailure = 'no-wallet' | 'is-session-wallet'

export type ActiveWalletResolution =
  | { ok: true; signer: ActiveWalletSigner }
  | { ok: false; reason: ActiveWalletFailure }

/**
 * Elige la billetera activa que puede firmar el enlace. Prefiere la de la aplicación
 * (desbloqueada) y cae a la externa; descarta la que ya es la billetera de la sesión.
 */
export async function detectActiveWalletSigner(input: {
  inAppUnlocked: boolean
  inAppAddress?: string | null
  inAppProvider?: Eip1193Provider | null
  externalProvider?: Eip1193Provider | null
  sessionAddress?: string | null
}): Promise<ActiveWalletResolution> {
  const session = (input.sessionAddress || '').toLowerCase()
  const candidates: ActiveWalletSigner[] = []

  if (input.inAppUnlocked && input.inAppAddress && input.inAppProvider) {
    candidates.push({ address: input.inAppAddress, provider: input.inAppProvider })
  }
  if (input.externalProvider) {
    try {
      const accounts = (await input.externalProvider.request({ method: 'eth_accounts' })) as string[]
      if (Array.isArray(accounts) && accounts[0]) {
        candidates.push({ address: accounts[0], provider: input.externalProvider })
      }
    } catch {
      // Una billetera externa que no responde no es un firmante disponible.
    }
  }

  if (candidates.length === 0) return { ok: false, reason: 'no-wallet' }
  const distinct = candidates.find((candidate) => candidate.address.toLowerCase() !== session)
  if (!distinct) return { ok: false, reason: 'is-session-wallet' }
  return { ok: true, signer: distinct }
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
