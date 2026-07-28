// Admin API authentication
// All admin endpoints must verify: (1) valid SIWE session, (2) wallet is a verifier.

import { authenticateUser } from './authenticateUser'
import type { Kysely } from 'kysely'
import type { DB } from '@/db/db.d.ts'

const VERIFIER_WALLETS = (process.env.NEXT_PUBLIC_VERIFIER_WALLET || '')
  .split(',').map(w => w.trim().toLowerCase()).filter(Boolean)

export interface AdminAuth {
  usuario_id: number
  billetera: string
}

export async function authenticateAdmin(
  db: Kysely<DB>,
  walletAddress: string,
  token: string,
): Promise<AdminAuth | null> {
  const auth = await authenticateUser(db, walletAddress, token)
  if (!auth) return null

  const wallet = walletAddress.toLowerCase()
  if (VERIFIER_WALLETS.length === 0 || !VERIFIER_WALLETS.includes(wallet)) {
    return null
  }

  return { usuario_id: auth.usuario.id, billetera: wallet }
}
