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
 * Validates wallet + token authentication.
 * Pattern used across all API routes — see app/api routes
 *
 * Token staleness: every SIWE login rotates `billetera_usuario.token`, so a
 * browser holding an older token (e.g. a verifier logged in before an e2e run
 * signed in with the same wallet) would get 401s. As a fallback, when the
 * token is missing or mismatched we accept a valid NextAuth session cookie for
 * the same wallet (the session JWT survives token rotation).
 *
 * R-#227 Fase 1 (session-first): la cookie de sesión se valida PRIMERO; el
 * token de `billetera_usuario` queda como camino legacy (lo usa Rails y
 * clientes no-browser). Con `AUTH_SESSION_ONLY=1` solo se acepta la sesión
 * (para medir dependencias del token antes de retirarlo en Fase 2).
 */
export async function authenticateUser(
  db: Kysely<DB>,
  walletAddress?: string,
  token?: string
): Promise<AuthenticatedUser | null> {
  const now = new Date().toISOString()
  const tag = `[auth:${now.slice(11, 19)}]`

  // 1) Sesión primero (cookie HttpOnly firmada con NEXTAUTH_SECRET): no sufre
  //    la rotación del token; identidad = session.sub == wallet.
  const sessionAuth = await authenticateBySession(db, walletAddress, tag)
  if (sessionAuth) {
    dbg(`${tag} AUTH OK via session cookie (session-first) — userId: ${sessionAuth.usuario.id}`)
    return sessionAuth
  }
  if (process.env.AUTH_SESSION_ONLY === '1') {
    dbg(`${tag} AUTH_SESSION_ONLY=1: sin sesión válida → 401 (token legacy deshabilitado)`)
    return null
  }

  // 2) Legacy: wallet + token contra billetera_usuario (Rails y no-browser).
  if (!walletAddress || !token) {
    dbg(`${tag} Missing auth params (y sin sesión) — wallet: ${!!walletAddress}, token: ${!!token}`)
    return null
  }

  const billetera = await db
    .selectFrom('billetera_usuario')
    .where('billetera', '=', walletAddress.toLowerCase())
    .selectAll()
    .executeTakeFirst()

  if (!billetera) {
    dbg(`${tag} Billetera not found for: ${walletAddress.toLowerCase().slice(0, 10)}...`)
    return null
  }

  if (billetera.token !== token) {
    dbg(`${tag} TOKEN MISMATCH for wallet ${walletAddress.toLowerCase().slice(0, 10)}... (sin sesión válida previa)`)
    dbg(`${tag}   DB token: ${(billetera.token || '').slice(0, 12)}... (len=${billetera.token?.length})`)
    dbg(`${tag}   Req token: ${token.slice(0, 12)}... (len=${token.length})`)
    return null
  }

  const usuario = await db
    .selectFrom('usuario')
    .where('id', '=', billetera.usuario_id)
    .selectAll()
    .executeTakeFirst()

  if (!usuario) {
    dbg(`${tag} Usuario not found for id: ${billetera.usuario_id}`)
    return null
  }

  dbg(`${tag} AUTH OK (legacy token) — userId: ${usuario.id}, wallet: ${walletAddress.toLowerCase().slice(0, 10)}...`)
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
