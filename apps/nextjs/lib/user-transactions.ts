import { Kysely } from 'kysely'
import type { DB } from '@/db/db.d'

export interface UserTransaction {
  id: number
  tipo: string
  crypto: string
  cantidad: number
  fecha: Date | string
  hash: string | null
  descripcion: string | null
}

export async function getUserTransactions(db: Kysely<DB>, usuarioId: number) {
  const transactions = await db
    .selectFrom('transaction')
    .where('usuario_id', '=', usuarioId)
    .select([
      'id',
      'tipo',
      'crypto',
      'cantidad',
      'fecha',
      'hash',
      'descripcion'
    ])
    .orderBy('fecha', 'desc')
    .execute()

  return transactions.map(t => ({
    ...t,
    cantidad: Number(t.cantidad),
    fecha: t.fecha
  }))
}

export async function getUserInfo(db: Kysely<DB>, usuarioId: number) {
  return await db
    .selectFrom('usuario')
    .where('id', '=', usuarioId)
    .select(['nusuario', 'nombre'])
    .executeTakeFirst()
}
