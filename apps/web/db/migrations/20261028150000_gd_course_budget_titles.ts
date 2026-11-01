import { Kysely, sql } from 'kysely'

// Títulos de las guías 4-6 del curso Global Disciples alineados con el sílabo de la
// guía 1 y con los archivos de contenido (https://github.com/pasosdeJesus/learn.tg/issues/161):
// guía 4 = el presupuesto del primer año, guía 5 = el director del programa y guía 6 =
// contacto con Global Disciples.
//
// La migración `20261027193000_gd_guides_contact_last_titles` había alineado los títulos
// con un orden que incluía "Save While Waiting" (Aave) en la guía 5 y el director en la
// 4, pero el contenido inglés quedó con el presupuesto en la 4 y el director en la 5 y el
// español no tenía la guía del presupuesto. Se deja un solo sílabo de seis guías:
// GD, clúster, fondo, presupuesto, director y contacto.
//
// Reversible.

const EN_COURSE = 10
const ES_COURSE = 11

const EN_TITLES: Record<string, string> = {
  guide4: 'The Academy Budget',
  guide5: 'The Program Director',
  guide6: 'Contact Global Disciples',
}
const ES_TITLES: Record<string, string> = {
  guia4: 'El presupuesto de la academia',
  guia5: 'El director de la academia',
  guia6: 'Contacta a Global Disciples',
}

const EN_PREVIOUS: Record<string, string> = {
  guide4: 'The Program Director',
  guide5: 'Save While Waiting',
  guide6: 'Contact Global Disciples',
}
const ES_PREVIOUS: Record<string, string> = {
  guia4: 'El director de la academia',
  guia5: 'Ahorra mientras esperas',
  guia6: 'Contacta a Global Disciples',
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
