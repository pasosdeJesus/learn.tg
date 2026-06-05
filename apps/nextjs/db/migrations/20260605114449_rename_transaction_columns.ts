import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE "transaction" RENAME COLUMN "type" TO "type"`.execute(db)
  await sql`ALTER TABLE "transaction" RENAME COLUMN "amount" TO "amount"`.execute(db)
  await sql`ALTER TABLE "transaction" RENAME COLUMN "balance_impact" TO "balance_impact"`.execute(db)
  await sql`ALTER TABLE "transaction" RENAME COLUMN "fecha" TO "date"`.execute(db)
  await sql`ALTER TABLE "transaction" RENAME COLUMN "created_at" TO "created_at"`.execute(db)
  await sql`ALTER TABLE "transaction" RENAME COLUMN "updated_at" TO "updated_at"`.execute(db)
  await sql`ALTER TABLE "transaction" RENAME COLUMN "synced" TO "synced"`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE "transaction" RENAME COLUMN "type" TO "type"`.execute(db)
  await sql`ALTER TABLE "transaction" RENAME COLUMN "amount" TO "amount"`.execute(db)
  await sql`ALTER TABLE "transaction" RENAME COLUMN "balance_impact" TO "balance_impact"`.execute(db)
  await sql`ALTER TABLE "transaction" RENAME COLUMN "date" TO "fecha"`.execute(db)
  await sql`ALTER TABLE "transaction" RENAME COLUMN "created_at" TO "created_at"`.execute(db)
  await sql`ALTER TABLE "transaction" RENAME COLUMN "updated_at" TO "updated_at"`.execute(db)
  await sql`ALTER TABLE "transaction" RENAME COLUMN "synced" TO "synced"`.execute(db)
}
