import { Kysely, sql } from 'kysely'

// Guide 1's outline is the canonical syllabus for the Global Disciples course
// (https://github.com/pasosdeJesus/learn.tg/issues/161): the database still had
// the old G3-G6 titles and availability suffixes.

async function setTitle(
  db: Kysely<unknown>,
  prefix: string,
  suffix: string,
  title: string,
): Promise<void> {
  await sql`
    UPDATE cor1440_gen_actividadpf AS a
       SET titulo = ${title}
      FROM cor1440_gen_proyectofinanciero AS c
     WHERE c.id = a.proyectofinanciero_id
       AND c."prefijoRuta" = ${prefix}
       AND a."sufijoRuta" = ${suffix}
  `.execute(db)
}

export async function up(db: Kysely<unknown>): Promise<void> {
  await setTitle(db, '/gdcluster', 'guide3', 'Fund Your Mission')
  await setTitle(db, '/gdcluster', 'guide4', 'Contact GD and Launch')
  await setTitle(db, '/gdcluster', 'guide5', 'The Program Director')
  await setTitle(db, '/gdcluster', 'guide6', 'Save While Waiting')

  await setTitle(db, '/redgd', 'guia3', 'Financia tu misión')
  await setTitle(db, '/redgd', 'guia4', 'Contacta a GD y lanza')
  await setTitle(db, '/redgd', 'guia5', 'El director de la academia')
  await setTitle(db, '/redgd', 'guia6', 'Ahorra mientras esperas')
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await setTitle(db, '/gdcluster', 'guide3', "Fund Your Network's Mission (available 2026-08-30)")
  await setTitle(db, '/gdcluster', 'guide4', 'Sustain and Grow (available 2026-09-03)')
  await setTitle(db, '/gdcluster', 'guide5', 'Contact Global Disciples (available 2026-09-10)')
  await setTitle(db, '/gdcluster', 'guide6', 'The Program Director (available 2026-09-17)')

  await setTitle(db, '/redgd', 'guia3', 'Financia la Misión de tu Red (disponible 2026-08-27)')
  await setTitle(db, '/redgd', 'guia4', 'Sostén y Crece (disponible 2026-09-03)')
  await setTitle(db, '/redgd', 'guia5', 'Contacta a Discípulos Globales (disponible 2026-09-10)')
  await setTitle(db, '/redgd', 'guia6', 'El Director de Programa (disponible 2026-09-17)')
}
