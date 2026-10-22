/**
 * Decisión de invitación de billetera con la base de datos (`POST /api/wallet/invite`).
 *
 * La política pura vive en `wallet-invite-policy.ts`; aquí sólo se resuelve si la
 * dirección invitada ya pertenece a una cuenta verificada. Ver el comentario de la
 * política: la invitada debe firmar el `accept`, así que habilitarla no une nada por sí
 * sola.
 */
import type { Kysely } from 'kysely'
import {
  canInviteWallet,
  type AccountTrust,
  type InviterPolicy,
} from './wallet-invite-policy'

/** Cuenta a la que pertenece la billetera invitada, si ya existe. */
export async function lookupInviteeTrust(
  db: Kysely<any>,
  address: string,
): Promise<AccountTrust | null> {
  const row = await db
    .selectFrom('billetera_usuario as bu')
    .innerJoin('usuario as u', 'u.id', 'bu.usuario_id')
    .select([
      'u.profilescore',
      'u.passport_name',
      'u.verified_church_relationship',
    ])
    .where('bu.billetera', '=', address.toLowerCase())
    .executeTakeFirst()
  return (row as AccountTrust | undefined) ?? null
}

/** Política aplicada a (invitador, dirección invitada). */
export async function canInviteAddress(
  db: Kysely<any>,
  inviter: AccountTrust | null | undefined,
  address: string,
): Promise<InviterPolicy> {
  const invitee = await lookupInviteeTrust(db, address)
  return canInviteWallet(inviter, invitee)
}
