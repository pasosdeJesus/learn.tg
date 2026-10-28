import { Kysely, sql } from 'kysely'

// R-#161 (revisión del operador, 2026-10-27): la presentación a Global Disciples es el
// **último** paso del curso, no el cuarto. El contenido se movió de archivo
// (`guide4` ← director, `guide5` ← ahorro, `guide6` ← contacto) y aquí se alinean los
// títulos de la base con el contenido y con el sílabo de la guía 1.
// El orden (`nombrecorto`) no cambia: G1..G6 siguen el mismo orden y el contacto queda
// en la posición 6.  https://github.com/pasosdeJesus/learn.tg/issues/161
//
// Reversible: el `down` deja los títulos anteriores.

const EN_COURSE = 10
const ES_COURSE = 11

const EN_TITLES: Record<string, string> = {
  guide4: 'The Program Director',
  guide5: 'Save While Waiting',
  guide6: 'Contact Global Disciples',
}
const ES_TITLES: Record<string, string> = {
  guia4: 'El director de la academia',
  guia5: 'Ahorra mientras esperas',
  guia6: 'Contacta a Global Disciples',
}

const EN_PREVIOUS: Record<string, string> = {
  guide4: 'Contact GD and Launch',
  guide5: 'The Program Director',
  guide6: 'Save While Waiting',
}
const ES_PREVIOUS: Record<string, string> = {
  guia4: 'Contacta a GD y lanza',
  guia5: 'El director de la academia',
  guia6: 'Ahorra mientras esperas',
}

async function setTitles(db: Kysely<any>, courseId: number, titles: Record<string, string>) {
  for (const [sufijoRuta, titulo] of Object.entries(titles)) {
    await sql`
      UPDATE cor1440_gen_actividadpf
         SET titulo = ${titulo}
       WHERE proyectofinanciero_id = ${courseId}
         AND "sufijoRuta" = ${sufijoRuta}
    `.execute(db)
  }
}

export async function up(db: Kysely<any>): Promise<void> {
  await setTitles(db, EN_COURSE, EN_TITLES)
  await setTitles(db, ES_COURSE, ES_TITLES)
}

export async function down(db: Kysely<any>): Promise<void> {
  await setTitles(db, EN_COURSE, EN_PREVIOUS)
  await setTitles(db, ES_COURSE, ES_PREVIOUS)
}
