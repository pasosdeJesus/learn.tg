import { Kysely, sql } from 'kysely'

// Guide 2 is "Form Your Cluster" (EN) and "Forma tu clúster" (ES), matching the
// guide content, Guide 1's outline and the Cluster page label. The rows already
// existed; this only replaces the old "Form Your Network of Churches" title and
// its availability suffix.

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    UPDATE cor1440_gen_actividadpf AS a
       SET titulo = 'Form Your Cluster'
      FROM cor1440_gen_proyectofinanciero AS c
     WHERE c.id = a.proyectofinanciero_id
       AND c."prefijoRuta" = '/gdcluster'
       AND a."sufijoRuta" = 'guide2'
  `.execute(db)

  await sql`
    UPDATE cor1440_gen_actividadpf AS a
       SET titulo = 'Forma tu clúster'
      FROM cor1440_gen_proyectofinanciero AS c
     WHERE c.id = a.proyectofinanciero_id
       AND c."prefijoRuta" = '/redgd'
       AND a."sufijoRuta" = 'guia2'
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    UPDATE cor1440_gen_actividadpf AS a
       SET titulo = 'Form Your Network of Churches (available 2026-08-23)'
      FROM cor1440_gen_proyectofinanciero AS c
     WHERE c.id = a.proyectofinanciero_id
       AND c."prefijoRuta" = '/gdcluster'
       AND a."sufijoRuta" = 'guide2'
  `.execute(db)

  await sql`
    UPDATE cor1440_gen_actividadpf AS a
       SET titulo = 'Forma tu Red de Iglesias (disponible 2026-08-20)'
      FROM cor1440_gen_proyectofinanciero AS c
     WHERE c.id = a.proyectofinanciero_id
       AND c."prefijoRuta" = '/redgd'
       AND a."sufijoRuta" = 'guia2'
  `.execute(db)
}
