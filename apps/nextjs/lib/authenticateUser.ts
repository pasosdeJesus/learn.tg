import { Kysely } from 'kysely'
import type { DB } from '@/db/db.d'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface AuthenticatedUser {
  usuario: any
  billetera: any
}

/**
 * Validates wallet + token authentication.
 * Pattern used across all API routes — see app/api routes
 */
export async function authenticateUser(
  db: Kysely<DB>,
  walletAddress?: string,
  token?: string
): Promise<AuthenticatedUser | null> {
  console.log('**[authenticateUser] wallet:', walletAddress?.slice(0, 10) + '...',
    'token:', token?.slice(0, 10) + '...')
  if (!walletAddress || !token) return null

  const billetera = await db
    .selectFrom('billetera_usuario')
    .where('billetera', '=', walletAddress.toLowerCase())
    .selectAll()
    .executeTakeFirst()

  if (!billetera) {
    console.log('**[authenticateUser] billetera not found for wallet:', walletAddress)
    return null
  }
  if (billetera.token !== token) {
    console.log('**[authenticateUser] token mismatch. DB token:', (billetera.token || '').slice(0, 10) + '...',
      'request token:', token.slice(0, 10) + '...')
    return null
  }

  const usuario = await db
    .selectFrom('usuario')
    .where('id', '=', billetera.usuario_id)
    .selectAll()
    .executeTakeFirst()

  if (!usuario) return null

  return { usuario: usuario as any, billetera }
}
