import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE msip_pais ADD COLUMN indicativo VARCHAR(10)`.execute(db)

  // Known calling codes
  await sql`UPDATE msip_pais SET indicativo = '+57' WHERE id = 170`.execute(db)     // Colombia
  await sql`UPDATE msip_pais SET indicativo = '+1' WHERE id = 840`.execute(db)      // Estados Unidos
  await sql`UPDATE msip_pais SET indicativo = '+232' WHERE id = 694`.execute(db)    // Sierra Leona
  await sql`UPDATE msip_pais SET indicativo = '+58' WHERE id = 862`.execute(db)     // Venezuela
  await sql`UPDATE msip_pais SET indicativo = '+504' WHERE id = 340`.execute(db)    // Honduras
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE msip_pais DROP COLUMN indicativo`.execute(db)
}
