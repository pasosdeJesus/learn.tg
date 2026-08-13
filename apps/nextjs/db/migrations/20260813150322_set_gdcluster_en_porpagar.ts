import { Kysely, sql } from 'kysely'

// The EN Global Disciples course (id=10, /gdcluster) was created without
// `porPagar`, so it was not marked as premium. This sets it to match the ES
// course (id=11, /redgd) which already has `porPagar = 1`.
export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    UPDATE cor1440_gen_proyectofinanciero
    SET "porPagar" = 1
    WHERE id = 10
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`
    UPDATE cor1440_gen_proyectofinanciero
    SET "porPagar" = NULL
    WHERE id = 10
  `.execute(db)
}
