import { Kysely } from 'kysely'
import type { DB } from '@/db/db.d'
import { cookies } from 'next/headers'
import { getToken } from 'next-auth/jwt'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface AuthenticatedUser {
  usuario: any
  billetera: any
}

// Diagnóstico gated (R-#224/R-#227): detalle solo con DEBUG_AUTH=1, nunca en
// logs normales de producción; no imprime tokens/PII completos.
function dbg(...args: any[]) {
  if (process.env.DEBUG_AUTH === '1') console.log(...args)
}

/**
 * Authenticates an API request against the shared NextAuth session.
 * Pattern used across all API routes — see app/api routes
 *
 * R-#233 Fase 2: the session cookie is the ONLY credential. The former
 * `walletAddress` + `billetera_usuario.token` path was removed: the column no
 * longer exists and no client stores or sends a token. The `walletAddress`
 * parameter remains only as an (untrusted) identity hint that must match the
 * session subject; the session alone decides.
 */
export async function authenticateUser(
  db: Kysely<DB>,
  walletAddress?: string
): Promise<AuthenticatedUser | null> {
  const now = new Date().toISOString()
  const tag = `[auth:${now.slice(11, 19)}]`

  const sessionAuth = await authenticateBySession(db, walletAddress, tag)
  if (sessionAuth) {
    dbg(`${tag} AUTH OK via session cookie — userId: ${sessionAuth.usuario.id}`)
    return sessionAuth
  }
  dbg(`${tag} Missing or invalid session — wallet hint: ${!!walletAddress}`)
  return null
}

/**
 * Accepts a valid NextAuth session cookie whose address matches the requested
 * wallet. Runs only inside a request context (route handlers).
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
      dbg(`${tag} Session fallback: no session-token cookie`)
      return null
    }
    const payload = await getToken({
      // getToken's SessionStore reads req.cookies (headers.cookie is ignored)
      req: { cookies: { [sessionCookie.name]: sessionCookie.value } } as any,
      cookieName: sessionCookie.name,
      secret: process.env.NEXTAUTH_SECRET,
    })
    const address = payload?.sub
    if (!address) {
      dbg(`${tag} Session fallback: token has no sub`)
      return null
    }
    if (address.toLowerCase() !== (walletAddress || '').toLowerCase()) {
      dbg(`${tag} Session fallback: wallet mismatch ${address.toLowerCase().slice(0, 10)}... != ${(walletAddress || '').slice(0, 10)}...`)
      return null
    }
    const billetera = await db
      .selectFrom('billetera_usuario')
      .where('billetera', '=', walletAddress!.toLowerCase())
      .selectAll()
      .executeTakeFirst()
    if (!billetera) {
      dbg(`${tag} Session fallback: billetera not found`)
      return null
    }
    const usuario = await db
      .selectFrom('usuario')
      .where('id', '=', billetera.usuario_id)
      .selectAll()
      .executeTakeFirst()
    if (!usuario) {
      dbg(`${tag} Session fallback: usuario not found`)
      return null
    }
    dbg(`${tag} AUTH OK via session cookie — userId: ${usuario.id}`)
    return { usuario: usuario as any, billetera }
  } catch (e: any) {
    dbg(`${tag} Session fallback failed:`, e?.message || String(e))
    return null
  }
}
