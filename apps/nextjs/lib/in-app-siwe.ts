'use client'

import { SiweMessage } from 'siwe'
import { getAddress } from 'viem'
import type { Eip1193Provider } from '@learn-tg/pdj-wallet'

const CHAIN_IDS: Record<string, number> = { celo: 42220, celoSepolia: 11142220 }

export type InAppSignInError = 'no-accounts' | 'no-csrf' | 'auth-failed'

/**
 * Signs in with the in-app wallet (SIWE) using the same endpoints as
 * `ConnectWalletButton`: the NextAuth session cookie is the credential, so this
 * only has to POST the signed message and remember the address for the cold
 * session fallback (#5719).
 *
 * Throws `InAppSignInError` codes so callers can translate them.
 */
export async function signInWithInAppWallet(provider: Eip1193Provider): Promise<string> {
  const accounts = (await provider.request({ method: 'eth_accounts' })) as string[]
  const account = accounts?.[0]
  if (!account) throw new Error('no-accounts' satisfies InAppSignInError)

  const csrfResponse = await fetch('/api/auth/csrf')
  const { csrfToken } = (await csrfResponse.json()) as { csrfToken?: string }
  if (!csrfToken) throw new Error('no-csrf' satisfies InAppSignInError)

  const network = process.env.NEXT_PUBLIC_NETWORK || 'celoSepolia'
  const message = new SiweMessage({
    domain: window.location.host,
    address: getAddress(account),
    statement: 'Sign in to Learn through games.',
    uri: window.location.origin,
    version: '1',
    chainId: CHAIN_IDS[network] ?? 11142220,
    nonce: csrfToken,
  }).prepareMessage()

  const signature = (await provider.request({
    method: 'personal_sign',
    params: [message, account],
  })) as string

  const body = new URLSearchParams({
    csrfToken,
    message,
    signature,
    redirect: 'false',
    json: 'true',
  })
  const callback = await fetch('/api/auth/callback/credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!callback.ok) throw new Error('auth-failed' satisfies InAppSignInError)

  // R-#256: el fallback se guarda en **minúsculas**, como `session.address` y todo
  // el resto de la app (doc/siwe-auth-flow.md §3). Guardarlo con checksum EIP-55
  // hacía que, sin sesión (por ejemplo sin conexión), la identidad cambiara de
  // forma: la clave `crossword-state-${address}` y las llamadas autenticadas
  // dejaban de coincidir y el estado guardado no se encontraba.
  const normalized = account.toLowerCase()
  localStorage.setItem('learn.tg.sessionAddress', normalized)
  return normalized
}
