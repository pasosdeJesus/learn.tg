import { Kysely } from 'kysely'
import type { DB } from '@/db/db.d'

export interface UserTransaction {
  id: number
  type: string
  crypto: string
  amount: number
  date: Date | string
  hash: string | null
  descripcion: string | null
}

export async function getUserTransactions(db: Kysely<DB>, usuarioId: number) {
  const transactions = await db
    .selectFrom('transaction')
    .where('usuario_id', '=', usuarioId)
    .select([
      'id',
      'type',
      'crypto',
      'amount',
      'date',
      'hash',
      'descripcion'
    ])
    .orderBy('date', 'desc')
    .execute()

  return transactions.map(t => ({
    ...t,
    amount: Number(t.amount),
  date: t.date
  }))
}

export async function getUserInfo(db: Kysely<DB>, usuarioId: number) {
  return await db
    .selectFrom('usuario')
    .where('id', '=', usuarioId)
    .select(['nusuario', 'nombre'])
    .executeTakeFirst()
}
