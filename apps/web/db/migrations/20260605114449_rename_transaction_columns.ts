import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql.raw(`ALTER TABLE "transaction" RENAME COLUMN "tipo" TO "type"`).execute(db)
  await sql.raw(`ALTER TABLE "transaction" RENAME COLUMN "cantidad" TO "amount"`).execute(db)
  await sql.raw(`ALTER TABLE "transaction" RENAME COLUMN "impacto_balance" TO "balance_impact"`).execute(db)
  await sql.raw(`ALTER TABLE "transaction" RENAME COLUMN "fecha" TO "date"`).execute(db)
  await sql.raw(`ALTER TABLE "transaction" RENAME COLUMN "fecha_creacion" TO "created_at"`).execute(db)
  await sql.raw(`ALTER TABLE "transaction" RENAME COLUMN "fecha_actualizacion" TO "updated_at"`).execute(db)
  await sql.raw(`ALTER TABLE "transaction" RENAME COLUMN "sincronizado" TO "synced"`).execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql.raw(`ALTER TABLE "transaction" RENAME COLUMN "type" TO "tipo"`).execute(db)
  await sql.raw(`ALTER TABLE "transaction" RENAME COLUMN "amount" TO "cantidad"`).execute(db)
  await sql.raw(`ALTER TABLE "transaction" RENAME COLUMN "balance_impact" TO "impacto_balance"`).execute(db)
  await sql.raw(`ALTER TABLE "transaction" RENAME COLUMN "date" TO "fecha"`).execute(db)
  await sql.raw(`ALTER TABLE "transaction" RENAME COLUMN "created_at" TO "fecha_creacion"`).execute(db)
  await sql.raw(`ALTER TABLE "transaction" RENAME COLUMN "updated_at" TO "fecha_actualizacion"`).execute(db)
  await sql.raw(`ALTER TABLE "transaction" RENAME COLUMN "synced" TO "sincronizado"`).execute(db)
}
