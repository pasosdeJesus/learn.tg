import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  const course = await sql<{ id: number }>`
    INSERT INTO cor1440_gen_proyectofinanciero (
      id, nombre, titulo, subtitulo, idioma, "prefijoRuta",
      fechainicio, fechaformulacion, responsable_id, estado, dificultad,
      monto, tasaej, montoej, aportepropioej, aporteotrosej, presupuestototalej,
      "sinBilletera", "conBilletera", chain_id,
      "creditosMd", "resumenMd",
      created_at, updated_at
    ) VALUES (
      10, 'Tools to Bring Global Disciples to Your Cluster', 'Tools to Bring Global Disciples to Your Cluster', 'Tools to Bring Global Disciples to Your Cluster',
      'en', '/gdcluster',
      '2026-08-04', '2026-08-04', 1, 'E', 'N',
      1.0, 1, 0, 0, 0, 0,
      true, true, 42220,
      'Prepared by Pasos de Jesús. All rights reserved.',
      'Tools to Bring Global Disciples to Your Cluster',
      NOW(), NOW()
    )
    RETURNING id
  `.execute(db)
  const courseId = course.rows[0].id
  console.log('[create-course] Generated course ID:', courseId)

  // Logical framework: 1 objective + 1 result
  const obj = await sql<{ id: number }>`
    INSERT INTO cor1440_gen_objetivopf (id, proyectofinanciero_id, numero, objetivo)
    VALUES (10, ${courseId}, 'O1', 'Tools to Bring Global Disciples to Your Cluster')
    RETURNING id
  `.execute(db)
  const objectiveId = obj.rows[0].id

  const res = await sql<{ id: number }>`
    INSERT INTO cor1440_gen_resultadopf (id, proyectofinanciero_id, objetivopf_id, numero, resultado)
    VALUES (10, ${courseId}, ${objectiveId}, 'R1', 'Tools to Bring Global Disciples to Your Cluster')
    RETURNING id
  `.execute(db)
  const resultId = res.rows[0].id

  await sql`
    INSERT INTO cor1440_gen_actividadpf (
      id, titulo, "nombrecorto", "sufijoRuta",
      proyectofinanciero_id, resultadopf_id
    ) VALUES (
      20, 'Tools to Bring Global Disciples to Your Cluster — Guide 1',
      'G1', 'guide1',
      ${courseId}, ${resultId}
    )
  `.execute(db)

  await sql`
    INSERT INTO cor1440_gen_actividadpf (
      id, titulo, "nombrecorto", "sufijoRuta",
      proyectofinanciero_id, resultadopf_id
    ) VALUES (
      21, 'Tools to Bring Global Disciples to Your Cluster — Guide 2',
      'G2', 'guide2',
      ${courseId}, ${resultId}
    )
  `.execute(db)

  await sql`
    INSERT INTO cor1440_gen_actividadpf (
      id, titulo, "nombrecorto", "sufijoRuta",
      proyectofinanciero_id, resultadopf_id
    ) VALUES (
      22, 'Tools to Bring Global Disciples to Your Cluster — Guide 3',
      'G3', 'guide3',
      ${courseId}, ${resultId}
    )
  `.execute(db)

  await sql`
    INSERT INTO cor1440_gen_actividadpf (
      id, titulo, "nombrecorto", "sufijoRuta",
      proyectofinanciero_id, resultadopf_id
    ) VALUES (
      23, 'Tools to Bring Global Disciples to Your Cluster — Guide 4',
      'G4', 'guide4',
      ${courseId}, ${resultId}
    )
  `.execute(db)

  await sql`
    INSERT INTO cor1440_gen_actividadpf (
      id, titulo, "nombrecorto", "sufijoRuta",
      proyectofinanciero_id, resultadopf_id
    ) VALUES (
      24, 'Tools to Bring Global Disciples to Your Cluster — Guide 5',
      'G5', 'guide5',
      ${courseId}, ${resultId}
    )
  `.execute(db)

  await sql`
    INSERT INTO cor1440_gen_actividadpf (
      id, titulo, "nombrecorto", "sufijoRuta",
      proyectofinanciero_id, resultadopf_id
    ) VALUES (
      25, 'Tools to Bring Global Disciples to Your Cluster — Guide 6',
      'G6', 'guide6',
      ${courseId}, ${resultId}
    )
  `.execute(db)

  await sql`
    INSERT INTO cor1440_gen_actividadpf (
      id, titulo, "nombrecorto", "sufijoRuta",
      proyectofinanciero_id, resultadopf_id
    ) VALUES (
      26, 'Tools to Bring Global Disciples to Your Cluster — Guide 7',
      'G7', 'guide7',
      ${courseId}, ${resultId}
    )
  `.execute(db)

}

export async function down(db: Kysely<any>): Promise<void> {
  const course = await db
    .selectFrom('cor1440_gen_proyectofinanciero')
    .select('id')
    .where('prefijoRuta', '=', '/gdcluster')
    .where('idioma', '=', 'en')
    .executeTakeFirst()

  if (course) {
    await sql`DELETE FROM cor1440_gen_actividadpf WHERE proyectofinanciero_id = ${course.id}`.execute(db)
    await sql`DELETE FROM cor1440_gen_resultadopf WHERE proyectofinanciero_id = ${course.id}`.execute(db)
    await sql`DELETE FROM cor1440_gen_objetivopf WHERE proyectofinanciero_id = ${course.id}`.execute(db)
    await sql`DELETE FROM cor1440_gen_proyectofinanciero WHERE id = ${course.id}`.execute(db)
  }
}
