import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // Verify ID is not already in use
  const existing = await db
    .selectFrom('cor1440_gen_proyectofinanciero')
    .select('id')
    .where('id', '=', 110)
    .executeTakeFirst()
  if (existing) {
    throw new Error('Course ID 110 already exists. Choose a different ID or omit it for auto-generation.')
  }

  await sql`
    INSERT INTO cor1440_gen_proyectofinanciero (
      id, nombre, titulo, subtitulo, idioma, "prefijoRuta",
      fechainicio, fechaformulacion, responsable_id, estado, dificultad,
      monto, tasaej, montoej, aportepropioej, aporteotrosej, presupuestototalej,
      "sinBilletera", "conBilletera", chain_id,
      "creditosMd", "resumenMd",
      created_at, updated_at
    ) VALUES (
      110, 'Tools to Bring Global Disciples to your Cluster of Churches', 'Tools to Bring Global Disciples to your Cluster of Churches', 'Tools to Bring Global Disciples to your Cluster of Churches',
      'en', '/gd-cluster',
      '2026-07-03', '2026-07-03', 1, 'E', 'N',
      1.0, 1, 0, 0, 0, 0,
      true, true, 42220,
      'Prepared by Pasos de Jesús. Open content with license CC-BY Internacional 4.0.',
      'Tools to Bring Global Disciples to your Cluster of Churches',
      NOW(), NOW()
    )
  `.execute(db)

  // Advance sequence past explicit ID
  await sql`SELECT setval('cor1440_gen_proyectofinanciero_id_seq', GREATEST(110, (SELECT COALESCE(MAX(id), 0) FROM cor1440_gen_proyectofinanciero)))`.execute(db)

  // Logical framework: 1 objective + 1 result (auto-generated IDs)
  const obj = await sql<{ id: number }>`
    INSERT INTO cor1440_gen_objetivopf (proyectofinanciero_id, numero, objetivo)
    VALUES (110, 'O1', 'Tools to Bring Global Disciples to your Cluster of Churches')
    RETURNING id
  `.execute(db)
  const objectiveId = obj.rows[0].id

  const res = await sql<{ id: number }>`
    INSERT INTO cor1440_gen_resultadopf (proyectofinanciero_id, objetivopf_id, numero, resultado)
    VALUES (110, ${objectiveId}, 'R1', 'Tools to Bring Global Disciples to your Cluster of Churches')
    RETURNING id
  `.execute(db)
  const resultId = res.rows[0].id

  await sql`
    INSERT INTO cor1440_gen_actividadpf (
      id, titulo, "nombrecorto", "sufijoRuta",
      proyectofinanciero_id, resultadopf_id
    ) VALUES (
      11001, 'Tools to Bring Global Disciples to your Cluster of Churches — Guide 1',
      'G1', 'guide1',
      110, ${resultId}
    )
  `.execute(db)

  await sql`
    INSERT INTO cor1440_gen_actividadpf (
      id, titulo, "nombrecorto", "sufijoRuta",
      proyectofinanciero_id, resultadopf_id
    ) VALUES (
      11002, 'Tools to Bring Global Disciples to your Cluster of Churches — Guide 2',
      'G2', 'guide2',
      110, ${resultId}
    )
  `.execute(db)

  await sql`
    INSERT INTO cor1440_gen_actividadpf (
      id, titulo, "nombrecorto", "sufijoRuta",
      proyectofinanciero_id, resultadopf_id
    ) VALUES (
      11003, 'Tools to Bring Global Disciples to your Cluster of Churches — Guide 3',
      'G3', 'guide3',
      110, ${resultId}
    )
  `.execute(db)

  await sql`
    INSERT INTO cor1440_gen_actividadpf (
      id, titulo, "nombrecorto", "sufijoRuta",
      proyectofinanciero_id, resultadopf_id
    ) VALUES (
      11004, 'Tools to Bring Global Disciples to your Cluster of Churches — Guide 4',
      'G4', 'guide4',
      110, ${resultId}
    )
  `.execute(db)

  await sql`
    INSERT INTO cor1440_gen_actividadpf (
      id, titulo, "nombrecorto", "sufijoRuta",
      proyectofinanciero_id, resultadopf_id
    ) VALUES (
      11005, 'Tools to Bring Global Disciples to your Cluster of Churches — Guide 5',
      'G5', 'guide5',
      110, ${resultId}
    )
  `.execute(db)

  // Advance actividadpf sequence past explicit IDs
  await sql`SELECT setval('cor1440_gen_actividadpf_id_seq', GREATEST(11005, (SELECT COALESCE(MAX(id), 0) FROM cor1440_gen_actividadpf)))`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DELETE FROM cor1440_gen_actividadpf WHERE id = 11001`.execute(db)
  await sql`DELETE FROM cor1440_gen_actividadpf WHERE id = 11002`.execute(db)
  await sql`DELETE FROM cor1440_gen_actividadpf WHERE id = 11003`.execute(db)
  await sql`DELETE FROM cor1440_gen_actividadpf WHERE id = 11004`.execute(db)
  await sql`DELETE FROM cor1440_gen_actividadpf WHERE id = 11005`.execute(db)
  await sql`DELETE FROM cor1440_gen_resultadopf WHERE proyectofinanciero_id = 110`.execute(db)
  await sql`DELETE FROM cor1440_gen_objetivopf WHERE proyectofinanciero_id = 110`.execute(db)
  await sql`DELETE FROM cor1440_gen_proyectofinanciero WHERE id = 110`.execute(db)
}
