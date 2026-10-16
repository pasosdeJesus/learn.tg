import { SiweMessage } from 'siwe'
import type { Address } from 'viem'
import { IS_PRODUCTION } from '@learn-tg/rewards/lib/config'

/**
 * Verificación SIWE del lado del servidor (R-#265 / doc/siwe-auth-flow.md).
 *
 * `auth-options.ts` ya verifica el mensaje de **inicio de sesión**; este módulo
 * extrae la misma política (dominio, red y nonce) para las rutas que verifican una
 * **segunda** billetera. El contrato del motor `wallet` exige que el consumidor
 * afirme que verificó la firma antes de enlazar (`siweVerified`), así que esta
 * función es la que sostiene esa afirmación.
 */

/** Red que la app espera al firmar (Celo mainnet en producción, Sepolia en el resto). */
export function expectedChainId(): number {
  return IS_PRODUCTION ? 42220 : 11142220
}

/**
 * Hostnames aceptados como dominio del SIWE: los publicados en producción y, fuera
 * de ella, `localhost` (el sandbox corre en `:4000`).
 */
export function allowedAuthHostnames(): string[] {
  const hosts = [
    'learn.tg',
    'learntg.pdj.app',
    'learn.tg:9001',
    'learntg.pdj.app:9001',
  ]
  if (!IS_PRODUCTION) {
    hosts.push('localhost', 'localhost:4300', 'localhost:4000')
  }
  return hosts
}

export type SiweVerifyFailure =
  | 'wrong-network'
  | 'wrong-domain'
  | 'invalid-signature'
  | 'error'

export type SiweVerifyResult =
  | { ok: true; address: string }
  | { ok: false; reason: SiweVerifyFailure }

/**
 * Verifica un mensaje SIWE ya firmado: dominio esperado, red esperada y `nonce`
 * (el `csrfToken` de NextAuth). Devuelve la dirección **checksum** del firmante, o
 * el motivo del rechazo (sin distinguir al usuario del error de firma).
 */
export async function verifySiweMessage(args: {
  message: unknown
  signature: unknown
  nonce: string
  hostname: string
}): Promise<SiweVerifyResult> {
  try {
    if (!args.hostname || !allowedAuthHostnames().includes(args.hostname)) {
      return { ok: false, reason: 'wrong-domain' }
    }
    const siwe = new SiweMessage(String(args.message ?? ''))
    if (siwe.chainId !== expectedChainId()) {
      return { ok: false, reason: 'wrong-network' }
    }
    const result = await siwe.verify({
      signature: String(args.signature ?? '0x0') as Address,
      domain: args.hostname,
      nonce: args.nonce,
    })
    if (!result.success) {
      return { ok: false, reason: 'invalid-signature' }
    }
    return { ok: true, address: siwe.address }
  } catch {
    return { ok: false, reason: 'error' }
  }
}
