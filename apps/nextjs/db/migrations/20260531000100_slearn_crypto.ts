import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    ALTER TABLE "transaction"
    DROP CONSTRAINT IF EXISTS transaction_crypto_check,
    ADD CONSTRAINT transaction_crypto_check
    CHECK (crypto::text = ANY (ARRAY['usdt', 'celo', 'learningpoints', 'slearn']))
  `.execute(db)

  await sql`
    ALTER TABLE "transaction"
    DROP CONSTRAINT IF EXISTS transaction_tipo_check,
    ADD CONSTRAINT transaction_tipo_check
    CHECK (tipo::text = ANY (ARRAY['scholarship', 'donation', 'pay-course', 'ubi-claim', 'conversion']))
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`
    ALTER TABLE "transaction"
    DROP CONSTRAINT IF EXISTS transaction_crypto_check,
    ADD CONSTRAINT transaction_crypto_check
    CHECK (crypto::text = ANY (ARRAY['usdt', 'celo', 'learningpoints']))
  `.execute(db)

  await sql`
    ALTER TABLE "transaction"
    DROP CONSTRAINT IF EXISTS transaction_tipo_check,
    ADD CONSTRAINT transaction_tipo_check
    CHECK (tipo::text = ANY (ARRAY['scholarship', 'donation', 'pay-course', 'ubi-claim']))
  `.execute(db)
}
