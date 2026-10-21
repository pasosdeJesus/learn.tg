import { CompiledQuery, type Kysely } from 'kysely'
import type { SqlExecutor } from 'generated-msip'

/**
 * R-#265 / m#50: puente hacia el motor `wallet` de `m`
 * (`packages/generated/wallet`, `generated-wallet`).
 *
 * El motor no abre conexiones: recibe un `SqlExecutor` (`query(text, params)`). Aquí
 * se adapta el `Kysely` de la app (`CompiledQuery.raw` + `getExecutor().executeQuery`)
 * reutilizando su pool, en vez de abrir uno nuevo con `pg`.
 *
 * Los flujos de N billeteras (sign-in, vincular/desvincular, invitar/aceptar) se
 * reexportan desde el motor para que `auth-options.ts` y las rutas de `app/api` los
 * usen sin depender del nombre del paquete vendorizado.
 */
export function kyselySqlExecutor(db: Kysely<any>): SqlExecutor {
  return {
    query: <R = Record<string, unknown>>(text: string, params?: unknown[]) =>
      db.getExecutor().executeQuery<R>(CompiledQuery.raw(text, params ?? [])),
  }
}

export {
  inspectWallet,
  signInWallet,
  linkSecondWallet,
  unlinkAccountWallet,
  inviteWalletToAccount,
  acceptWalletInvitation,
  cancelAccountInvitation,
  listWallets,
  listInvitations,
  findPendingInvitation,
  getUserByWallet,
  WalletNotVerifiedError,
  WalletOwnedByOtherError,
  WalletInvitationError,
  InvalidWalletAddressError,
  isValidAddress,
  normalizeWallet,
} from 'generated-wallet'

export type {
  WalletSignInInfo,
  WalletSignInResult,
  WalletLink,
  WalletInvitation,
} from 'generated-wallet'
