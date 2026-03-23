import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  //  update the constraint to replace 'earn-guide' with 'scholarship'
  await sql`
    ALTER TABLE "transaction"
    DROP CONSTRAINT IF EXISTS "transaction_tipo_check"
  `.execute(db)


  // Update any existing records with tipo = 'earn-guide' to 'scholarship'
  await sql`
    UPDATE "transaction"
    SET tipo = 'scholarship'
    WHERE tipo = 'earn-guide'
  `.execute(db)

  await sql`
    ALTER TABLE "transaction"
    ADD CONSTRAINT "transaction_tipo_check"
    CHECK (tipo IN ('scholarship', 'donation', 'pay-course', 'ubi-claim'))
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  // First, revert constraint back to original values
  await sql`
    ALTER TABLE "transaction"
    DROP CONSTRAINT IF EXISTS "transaction_tipo_check"
  `.execute(db)

  await sql`
    ALTER TABLE "transaction"
    ADD CONSTRAINT "transaction_tipo_check"
    CHECK (tipo IN ('earn-guide', 'donation', 'pay-course', 'ubi-claim'))
  `.execute(db)

  // Then, revert any records that were updated
  await sql`
    UPDATE "transaction"
    SET tipo = 'earn-guide'
    WHERE tipo = 'scholarship'
  `.execute(db)
}
