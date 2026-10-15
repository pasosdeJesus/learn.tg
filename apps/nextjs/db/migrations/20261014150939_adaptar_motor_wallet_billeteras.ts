import { Kysely, sql } from 'kysely'

// R-#265 / m#50 — alinear learn.tg con el motor `wallet` de `m`.
// https://github.com/pasosdeJesus/learn.tg/issues/265
//
// El motor `wallet` (vendorizado en `packages/generated/wallet` como
// `generated-wallet`) es dueño de `billetera_usuario`/`billetera_invitada`; su
// migración las crea (`db/migrations/20260101000000_wallet_model.ts`, escrita por
// `bin/m eng:setup wallet`) con `CREATE TABLE IF NOT EXISTS`, por lo que sobre una
// base que ya las tenía como extensión de `msip` es una no-op. Esta migración queda
// entonces SOLO con el delta que aquella no puede aplicar en una tabla preexistente:
// las columnas `linked_at`/`linked_by` (las usa el motor para `linkSecondWallet`).
// Aditiva e idempotente (`IF NOT EXISTS`), reversible.

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE billetera_usuario ADD COLUMN IF NOT EXISTS linked_at timestamp without time zone NOT NULL DEFAULT now()`.execute(db)
  await sql`ALTER TABLE billetera_usuario ADD COLUMN IF NOT EXISTS linked_by character varying(60)`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE billetera_usuario DROP COLUMN IF EXISTS linked_by`.execute(db)
  await sql`ALTER TABLE billetera_usuario DROP COLUMN IF EXISTS linked_at`.execute(db)
}
