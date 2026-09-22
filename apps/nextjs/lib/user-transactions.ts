import { Kysely } from 'kysely'
import type { DB } from '@/db/db.d'

export interface UserTransaction {
  id: number
  type: string
  crypto: string
  amount: number
  balance_impact: number
  date: Date | string
  hash: string | null
  descripcion: string | null
  // Agrupación lógica del movimiento y su detalle: `categoria` agrupa ('payment',
  // 'donation', 'cashback'…) y `subcategoria` precisa ('course_purchase',
  // 'cluster', 'country'). Sin ellas, una compra de curso pagada en USDT y SLEARN
  // se veía como dos filas indistinguibles de cualquier otro pago.
  categoria: string | null
  subcategoria: string | null
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
      'balance_impact',
      'date',
      'hash',
      'descripcion',
      'categoria',
      'subcategoria'
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
