/**
 * Controllers del motor `wallet` ([REQ/50](https://gitlab.com/pasosdeJesus/m/-/work_items/50) D3) — la **faceta C**.
 *
 * Los flujos de `doc/identidad-multibilletera.md` §5 codificados: sign-in, vincular
 * una segunda billetera, invitar/aceptar/cancelar y desvincular. **No** gestionan la
 * sesión ni verifican firmas (eso es del consumidor, §4.2/§7.1): el consumidor
 * **afirma** (`siweVerified`/`inviterVerified`) que ya verificó la firma/SIWE y estos
 * controllers lo exigen como precondición, para no dejar pasar el orden incorrecto.
 *
 * El consumidor (p. ej. `auth-options.ts` de NextAuth) llama a `signInWallet` dentro
 * de `authorize()`, y a los demás desde sus rutas. Sin sesión propia del núcleo.
 *
 * "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)
 */

import type { SqlExecutor, Usuario } from 'generated-msip'

import {
  getUserByWallet, listWallets, upsertUserByWallet, linkWallet, unlinkWallet,
  inviteWallet, cancelInvitation, findPendingInvitation, acceptInvitation,
  type WalletLink, type WalletInvitation,
} from './wallet-link.js'

/**
 * El consumidor no afirmó que verificó la firma/SIWE antes de la operación.
 *
 * Es un **recordatorio de contrato** (V4), **no** un control criptográfico: el motor
 * no verifica firmas; si el consumidor pasa `true` por error, el guard no protege.
 */
export class WalletNotVerifiedError extends Error {
  constructor(operation: string) {
    super(`${operation}: la firma/SIWE debe verificarse en el consumidor antes de llamar al motor`)
    this.name = 'WalletNotVerifiedError'
  }
}

/** Lo que ve la UI al conectar una billetera (sin crear cuenta). */
export interface WalletSignInInfo {
  usuario: Usuario | null
  wallets: WalletLink[]
  pendingInvitation: WalletInvitation | null
}

/** Resultado de un sign-in exitoso. */
export interface WalletSignInResult {
  usuario: Usuario
  wallets: WalletLink[]
  created: boolean
}

/**
 * Inspecciona una billetera ya verificada: cuenta (o `null`), sus billeteras e
 * invitación pendiente. Para que la UI ofrezca "crear cuenta", "iniciar sesión" o
 * "aceptar la invitación de la cuenta X".
 */
export async function inspectWallet(db: SqlExecutor, address: string): Promise<WalletSignInInfo> {
  const usuario = await getUserByWallet(db, address)
  const wallets = usuario ? await listWallets(db, usuario.id) : []
  const pendingInvitation = await findPendingInvitation(db, address)
  return { usuario, wallets, pendingInvitation }
}

/**
 * Inicia sesión con una billetera **ya verificada** (SIWE). Si la billetera pertenece
 * a una cuenta, la devuelve con sus billeteras; si es nueva, decide según
 * `createIfUnknown` (la política del consumidor: crear cuenta o solo por invitación).
 */
export async function signInWallet(
  db: SqlExecutor,
  address: string,
  options: { siweVerified: boolean; createIfUnknown?: boolean; ip?: string },
): Promise<WalletSignInResult | null> {
  if (!options.siweVerified) throw new WalletNotVerifiedError('signInWallet')
  const existing = await getUserByWallet(db, address)
  if (!existing && !options.createIfUnknown) return null
  const { usuario, created } = await upsertUserByWallet(db, address, { ip: options.ip })
  return { usuario, wallets: await listWallets(db, usuario.id), created }
}

/**
 * Vincula una **segunda** billetera a la cuenta del usuario autenticado. Exige que el
 * consumidor haya verificado una firma SIWE **de la nueva** billetera (§3.2).
 */
export async function linkSecondWallet(
  db: SqlExecutor,
  args: { usuarioId: number; address: string; signatureVerified: boolean; linkedBy?: string },
): Promise<void> {
  if (!args.signatureVerified) throw new WalletNotVerifiedError('linkSecondWallet')
  await linkWallet(db, args.usuarioId, args.address, { linkedBy: args.linkedBy })
}

/** Desvincula una billetera de la cuenta (falla si es la última). */
export async function unlinkAccountWallet(
  db: SqlExecutor,
  usuarioId: number,
  address: string,
): Promise<boolean> {
  return unlinkWallet(db, usuarioId, address)
}

/**
 * Invita una dirección a unirse a la cuenta. Exige que el consumidor haya verificado
 * **al usuario que invita** (§7: solo usuarios verificados invitan).
 */
export async function inviteWalletToAccount(
  db: SqlExecutor,
  args: { usuarioId: number; address: string; inviterVerified: boolean; expiresAt?: Date },
): Promise<WalletInvitation> {
  if (!args.inviterVerified) throw new WalletNotVerifiedError('inviteWalletToAccount')
  return inviteWallet(db, args.usuarioId, args.address, { expiresAt: args.expiresAt })
}

/**
 * Acepta la invitación de `address` para la cuenta: enlaza y marca `used_at`
 * (transaccional). Exige SIWE verificado de la billetera invitada.
 */
export async function acceptWalletInvitation(
  db: SqlExecutor,
  args: { usuarioId: number; address: string; signatureVerified: boolean },
): Promise<void> {
  if (!args.signatureVerified) throw new WalletNotVerifiedError('acceptWalletInvitation')
  await acceptInvitation(db, args.address, args.usuarioId)
}

/** Cancela una invitación pendiente de la cuenta. */
export async function cancelAccountInvitation(
  db: SqlExecutor,
  usuarioId: number,
  address: string,
): Promise<boolean> {
  return cancelInvitation(db, usuarioId, address)
}
