import { Kysely, sql } from 'kysely'

// https://github.com/pasosdeJesus/learn.tg/issues/265
//
// Una cuenta puede tener N billeteras, así que una compra de curso debe quedar
// asociada a la billetera que **hizo el pago**, no a una elegida después. Hasta
// ahora la fila sólo guardaba `usuario_id` y el roster de administración derivaba
// una billetera (la más antigua), lo que podía mostrar una billetera distinta de
// la que pagó.
//
// La columna queda NULL-able a propósito: la base puede recibir compras de una
// versión anterior de la API durante el despliegue, y el roster usa la billetera
// histórica (la más antigua) como respaldo para esas filas.

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE premium_course_usuario ADD COLUMN billetera character varying(60)`.execute(db)

  // Backfill desde el registro del pago: las filas de `transaction` de la compra
  // guardan la billetera que pagó y el hash de `processPayment`, que es el que
  // referencia `premium_course_usuario.transaction_hash`.
  await sql`
    UPDATE premium_course_usuario AS pcu
       SET billetera = p.wallet
      FROM (
        SELECT usuario_id,
               metadata->>'processPaymentHash' AS payment_hash,
               MIN(wallet) AS wallet
          FROM transaction
         WHERE type = 'pay-course'
           AND wallet IS NOT NULL
           AND metadata ? 'processPaymentHash'
         GROUP BY usuario_id, metadata->>'processPaymentHash'
      ) AS p
     WHERE p.usuario_id = pcu.usuario_id
       AND p.payment_hash = pcu.transaction_hash
       AND pcu.billetera IS NULL
  `.execute(db)

  // Sin registro de pago (datos anteriores): billetera más antigua de la cuenta,
  // la misma regla determinista que usaba el roster.
  await sql`
    UPDATE premium_course_usuario AS pcu
       SET billetera = (
         SELECT bw.billetera
           FROM billetera_usuario bw
          WHERE bw.usuario_id = pcu.usuario_id
          ORDER BY bw.linked_at, bw.id
          LIMIT 1
       )
     WHERE pcu.billetera IS NULL
  `.execute(db)

  await sql`CREATE INDEX idx_premium_course_usuario_billetera
    ON premium_course_usuario(billetera)`.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_premium_course_usuario_billetera`.execute(db)
  await sql`ALTER TABLE premium_course_usuario DROP COLUMN IF EXISTS billetera`.execute(db)
}
