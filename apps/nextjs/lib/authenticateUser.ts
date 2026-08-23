import { Kysely } from 'kysely'
import type { DB } from '@/db/db.d'
import { cookies } from 'next/headers'
import { getToken } from 'next-auth/jwt'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface AuthenticatedUser {
  usuario: any
  billetera: any
}

/**
 * Validates wallet + token authentication.
 * Pattern used across all API routes — see app/api routes
 *
 * Token staleness: every SIWE login rotates `billetera_usuario.token`, so a
 * browser holding an older token (e.g. a verifier logged in before an e2e run
 * signed in with the same wallet) would get 401s. As a fallback, when the
 * token is missing or mismatched we accept a valid NextAuth session cookie for
 * the same wallet (the session JWT survives token rotation).
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
    return authenticateBySession(db, walletAddress, tag)
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
    return authenticateBySession(db, walletAddress, tag)
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

/**
 * Fallback: accept a valid NextAuth session cookie whose address matches the
 * requested wallet. Runs only inside a request context (route handlers).
 *
 * Uses `cookies()` (async) + getToken directly instead of getServerSession,
 * which relies on the sync cookies() API removed in Next 16.
 */
async function authenticateBySession(
  db: Kysely<DB>,
  walletAddress?: string,
  tag?: string
): Promise<AuthenticatedUser | null> {
  try {
    const store = await cookies()
    const sessionCookie = store.getAll().find(c => c.name.includes('session-token'))
    if (!sessionCookie) {
      console.log(`${tag} Session fallback: no session-token cookie`)
      return null
    }
    const payload = await getToken({
      req: { headers: { cookie: `${sessionCookie.name}=${sessionCookie.value}` } } as any,
      cookieName: sessionCookie.name,
      secret: process.env.NEXTAUTH_SECRET,
    })
    const address = payload?.sub
    if (!address) {
      console.log(`${tag} Session fallback: token has no sub`)
      return null
    }
    if (address.toLowerCase() !== (walletAddress || '').toLowerCase()) {
      console.log(`${tag} Session fallback: wallet mismatch ${address.toLowerCase().slice(0, 10)}... != ${(walletAddress || '').slice(0, 10)}...`)
      return null
    }
    const billetera = await db
      .selectFrom('billetera_usuario')
      .where('billetera', '=', walletAddress!.toLowerCase())
      .selectAll()
      .executeTakeFirst()
    if (!billetera) {
      console.log(`${tag} Session fallback: billetera not found`)
      return null
    }
    const usuario = await db
      .selectFrom('usuario')
      .where('id', '=', billetera.usuario_id)
      .selectAll()
      .executeTakeFirst()
    if (!usuario) {
      console.log(`${tag} Session fallback: usuario not found`)
      return null
    }
    console.log(`${tag} AUTH OK via session cookie — userId: ${usuario.id}`)
    return { usuario: usuario as any, billetera }
  } catch (e: any) {
    console.log(`${tag} Session fallback failed:`, e?.message || String(e))
    return null
  }
}
