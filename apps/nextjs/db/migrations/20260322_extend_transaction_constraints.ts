import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // 1. Extend crypto constraint to include 'celo'
  await sql`
    ALTER TABLE "transaction"
    DROP CONSTRAINT IF EXISTS "transaction_crypto_check"
  `.execute(db)

  await sql`
    ALTER TABLE "transaction"
    ADD CONSTRAINT "transaction_crypto_check"
    CHECK (crypto IN ('learningpoints', 'usdt', 'celo'))
  `.execute(db)

  // 2. Extend tipo constraint to include 'ubi-claim'
  await sql`
    ALTER TABLE "transaction"
    DROP CONSTRAINT IF EXISTS "transaction_tipo_check"
  `.execute(db)

  await sql`
    ALTER TABLE "transaction"
    ADD CONSTRAINT "transaction_tipo_check"
    CHECK (tipo IN ('earn-guide', 'donation', 'pay-course', 'ubi-claim'))
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  // Restore original constraints
  await sql`
    ALTER TABLE "transaction"
    DROP CONSTRAINT IF EXISTS "transaction_crypto_check"
  `.execute(db)

  await sql`
    ALTER TABLE "transaction"
    ADD CONSTRAINT "transaction_crypto_check"
    CHECK (crypto IN ('learningpoints', 'usdt'))
  `.execute(db)

  await sql`
    ALTER TABLE "transaction"
    DROP CONSTRAINT IF EXISTS "transaction_tipo_check"
  `.execute(db)

  await sql`
    ALTER TABLE "transaction"
    ADD CONSTRAINT "transaction_tipo_check"
    CHECK (tipo IN ('earn-guide', 'donation', 'pay-course'))
  `.execute(db)
}