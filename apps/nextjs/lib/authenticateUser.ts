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
  const now = new Date().toISOString()
  const tag = `[auth:${now.slice(11, 19)}]`

  if (!walletAddress || !token) {
    console.log(`${tag} Missing auth params — wallet: ${!!walletAddress}, token: ${!!token}, tokenLen: ${token?.length || 0}`)
    return null
  }

  const billetera = await db
    .selectFrom('billetera_usuario')
    .where('billetera', '=', walletAddress.toLowerCase())
    .selectAll()
    .executeTakeFirst()

  if (!billetera) {
    console.log(`${tag} Billetera not found for: ${walletAddress.toLowerCase().slice(0, 10)}...`)
    return null
  }

  if (billetera.token !== token) {
    console.log(`${tag} TOKEN MISMATCH for wallet ${walletAddress.toLowerCase().slice(0, 10)}...`)
    console.log(`${tag}   DB token: ${(billetera.token || '').slice(0, 12)}... (len=${billetera.token?.length})`)
    console.log(`${tag}   Req token: ${token.slice(0, 12)}... (len=${token.length})`)
    console.log(`${tag}   Match first 8: ${billetera.token?.slice(0, 8) === token.slice(0, 8)}`)
    return null
  }

  const usuario = await db
    .selectFrom('usuario')
    .where('id', '=', billetera.usuario_id)
    .selectAll()
    .executeTakeFirst()

  if (!usuario) {
    console.log(`${tag} Usuario not found for id: ${billetera.usuario_id}`)
    return null
  }

  console.log(`${tag} AUTH OK — userId: ${usuario.id}, wallet: ${walletAddress.toLowerCase().slice(0, 10)}...`)
  return { usuario: usuario as any, billetera }
}
