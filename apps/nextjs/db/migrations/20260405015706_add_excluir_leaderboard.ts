import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // Add excluir_leaderboard column to usuario table
  await sql`
    ALTER TABLE usuario
    ADD COLUMN excluir_leaderboard BOOLEAN DEFAULT FALSE
  `.execute(db)

  // Update excluir_leaderboard = true for users with specific wallet addresses
  await sql`
    UPDATE usuario u
    SET excluir_leaderboard = TRUE
    WHERE EXISTS (
      SELECT 1 FROM billetera_usuario bu
      WHERE bu.usuario_id = u.id
        AND LOWER(bu.billetera) IN (
          '0x2e2c4ac19c93d0984840cdd8e7f77500e2ef978e',
          '0x6b3bc1b55b28380193733a2fd27f2639d92f14be',
          '0x358643badcc77cccb28a319abd439438a57339a7',
          '0x12680bc4cce8cd772c7a105d3f230ddb81c2ac4a',
          '0xb9c0dba5c5aae5fe81b327ff895227ee7fc44d81',
          '0x84027f515c6a747690b590e9242ca296a38a2e97'
        )
    )
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  // Remove excluir_leaderboard column
  await sql`
    ALTER TABLE usuario
    DROP COLUMN excluir_leaderboard
  `.execute(db)
}
