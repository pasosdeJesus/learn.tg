import { Kysely, sql } from 'kysely'

// The Global Disciples course subtitle and resume (resumenMd) were set to the
// same text, so the course page rendered the description twice (once as the
// <h2> subtitle and once as the article summary). Clear resumenMd so the
// description only appears once.
export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    UPDATE cor1440_gen_proyectofinanciero
    SET "resumenMd" = '', updated_at = NOW()
    WHERE id IN (10, 11)
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  // No-op: resumenMd originally duplicated subtitulo; there is nothing to
  // meaningfully restore without hardcoding the old text.
}
