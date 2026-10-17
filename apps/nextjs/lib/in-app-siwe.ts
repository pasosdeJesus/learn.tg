'use client'

import { SiweMessage } from 'siwe'
import { getAddress } from 'viem'
import { signIn } from 'next-auth/react'
import type { Eip1193Provider } from '@pasosdejesus/m/wallet'
import { getAppChain } from '@/lib/app-chain'
import { invitationPrompt, resolveInvitationAfterAuthFailure } from '@/lib/wallet-invitations'

export type InAppSignInError = 'no-accounts' | 'no-csrf' | 'auth-failed'

export interface InAppSignInOptions {
  lang?: 'en' | 'es'
  /**
   * Decide si la billetera se une a la cuenta que la invitó (R-#265 §3.2).
   * Por defecto se pregunta con `window.confirm` (el consentimiento es explícito).
   */
  confirmInvitation?: (invitedBy: string | null) => boolean | Promise<boolean>
}

/**
 * Signs in with the in-app wallet (SIWE) using the same endpoints as
 * `ConnectWalletButton`: the NextAuth session cookie is the credential, so this
 * only has to POST the signed message and remember the address for the cold
 * session fallback (#5719).
 *
 * When the callback rejects the wallet because it has a pending **invitation**
 * (R-#265 §3.2: an invited wallet must not create its own account on a plain
 * sign-in), it probes the invitation, asks for explicit confirmation, links the
 * wallet and retries the callback with the **same** signature.
 *
 * Throws `InAppSignInError` codes so callers can translate them.
 */
export async function signInWithInAppWallet(
  provider: Eip1193Provider,
  options: InAppSignInOptions = {},
): Promise<string> {
  const accounts = (await provider.request({ method: 'eth_accounts' })) as string[]
  const account = accounts?.[0]
  if (!account) throw new Error('no-accounts' satisfies InAppSignInError)

  const csrfResponse = await fetch('/api/auth/csrf')
  const { csrfToken } = (await csrfResponse.json()) as { csrfToken?: string }
  if (!csrfToken) throw new Error('no-csrf' satisfies InAppSignInError)

  // La red del mensaje es la de la app (`getAppChain()`), no la que declara la
  // billetera: es la que el servidor espera (`auth-options.ts` compara con
  // `IS_PRODUCTION ? 42220 : 11142220`) y la de los pagos. Firmar no depende de la
  // red, así que una billetera creada en Celo Sepolia puede iniciar sesión aquí.
  const message = new SiweMessage({
    domain: window.location.host,
    address: getAddress(account),
    statement: 'Sign in to Learn through games.',
    uri: window.location.origin,
    version: '1',
    chainId: getAppChain().id,
    nonce: csrfToken,
  }).prepareMessage()

  const signature = (await provider.request({
    method: 'personal_sign',
    params: [message, account],
  })) as string

  const attempt = () => signIn('credentials', {
    redirect: false,
    message,
    signature,
    // R-#246 §8: `userevent` registra con qué billetera se inició sesión
    // (`in-app`, `eip6963:<rdns>` o `window.ethereum`).
    walletSource: 'in-app',
  })

  // `signIn()` de next-auth/react **refresca el SessionProvider** después de un
  // callback exitoso con `redirect: false` (`react/index.js` llama a
  // `__NEXTAUTH._getSession({ event: 'storage' })`). Postear a mano el callback
  // obligaba a recargar la página para que la cabecera viera la sesión, y la recarga
  // saca la clave de la memoria (R-#265, doble desbloqueo). Ver el bug abierto de v4
  // https://github.com/nextauthjs/next-auth/issues/13173.
  let result = await attempt()
  if (!result?.ok || result.error) {
    // R-#265 §3.2: el callback rechaza una billetera **invitada** para que no cree
    // su propia cuenta; si la invitación existe se pregunta y, al aceptar, se
    // enlaza y se reintenta con la misma firma.
    const lang = options.lang === 'es' ? 'es' : 'en'
    const outcome = await resolveInvitationAfterAuthFailure({
      message,
      signature,
      confirm:
        options.confirmInvitation ??
        ((invitedBy) => window.confirm(invitationPrompt(lang, invitedBy))),
    })
    if (outcome === 'accepted') {
      result = await attempt()
      if (!result?.ok || result.error) throw new Error('auth-failed' satisfies InAppSignInError)
    } else {
      throw new Error('auth-failed' satisfies InAppSignInError)
    }
  }

  // R-#256: el fallback se guarda en **minúsculas**, como `session.address` y todo
  // el resto de la app (doc/siwe-auth-flow.md §3). Guardarlo con checksum EIP-55
  // hacía que, sin sesión (por ejemplo sin conexión), la identidad cambiara de
  // forma: la clave `crossword-state-${address}` y las llamadas autenticadas
  // dejaban de coincidir y el estado guardado no se encontraba.
  const normalized = account.toLowerCase()
  localStorage.setItem('learn.tg.sessionAddress', normalized)
  return normalized
}
