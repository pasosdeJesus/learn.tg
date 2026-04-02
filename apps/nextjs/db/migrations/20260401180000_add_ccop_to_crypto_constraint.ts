import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // Extend crypto constraint to include 'ccop'
  await sql`
    ALTER TABLE "transaction"
    DROP CONSTRAINT IF EXISTS "transaction_crypto_check"
  `.execute(db)

  await sql`
    ALTER TABLE "transaction"
    ADD CONSTRAINT "transaction_crypto_check"
    CHECK (crypto IN ('learningpoints', 'usdt', 'celo', 'ccop'))
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  // Restore previous constraint (without 'ccop')
  await sql`
    ALTER TABLE "transaction"
    DROP CONSTRAINT IF EXISTS "transaction_crypto_check"
  `.execute(db)

  await sql`
    ALTER TABLE "transaction"
    ADD CONSTRAINT "transaction_crypto_check"
    CHECK (crypto IN ('learningpoints', 'usdt', 'celo'))
  `.execute(db)
}