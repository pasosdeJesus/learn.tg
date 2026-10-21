import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  const course = await sql<{ id: number }>`
    INSERT INTO cor1440_gen_proyectofinanciero (
      id, nombre, titulo, subtitulo, idioma, "prefijoRuta",
      fechainicio, fechaformulacion, responsable_id, estado, dificultad,
      monto, tasaej, montoej, aportepropioej, aporteotrosej, presupuestototalej,
      "sinBilletera", "conBilletera", chain_id,
      "creditosMd", "resumenMd", "porPagar",
      created_at, updated_at
    ) VALUES (
      11, 'Herramientas para traer Discípulos Globales a tu red de iglesias',
      'Herramientas para traer Discípulos Globales a tu red de iglesias',
      'Herramientas para traer Discípulos Globales a tu red de iglesias',
      'es', '/redgd',
      '2026-08-04', '2026-08-04', 1, 'E', 'N',
      1.0, 1, 0, 0, 0, 0,
      true, true, 42220,
      'Preparado por Pasos de Jesús. Todos los derechos reservados.',
      'Herramientas para traer Discípulos Globales a tu red de iglesias',
      1,
      NOW(), NOW()
    )
    RETURNING id
  `.execute(db)
  const courseId = course.rows[0].id
  console.log('[create-course-es] Generated course ID:', courseId)

  const obj = await sql<{ id: number }>`
    INSERT INTO cor1440_gen_objetivopf (id, proyectofinanciero_id, numero, objetivo)
    VALUES (11, ${courseId}, 'O1', 'Herramientas para traer Discípulos Globales a tu red de iglesias')
    RETURNING id
  `.execute(db)
  const objectiveId = obj.rows[0].id

  const res = await sql<{ id: number }>`
    INSERT INTO cor1440_gen_resultadopf (id, proyectofinanciero_id, objetivopf_id, numero, resultado)
    VALUES (11, ${courseId}, ${objectiveId}, 'R1', 'Herramientas para traer Discípulos Globales a tu red de iglesias')
    RETURNING id
  `.execute(db)
  const resultId = res.rows[0].id

  const guides = [
    { id: 30, corto: 'G1', sufijo: 'guia1', titulo: '¿Qué es Discípulos Globales?' },
    { id: 31, corto: 'G2', sufijo: 'guia2', titulo: 'Forma tu Red de Iglesias' },
    { id: 32, corto: 'G3', sufijo: 'guia3', titulo: 'Financia la Misión de tu Red' },
    { id: 33, corto: 'G4', sufijo: 'guia4', titulo: 'Sostén y Crece' },
    { id: 34, corto: 'G5', sufijo: 'guia5', titulo: 'Contacta a Discípulos Globales' },
    { id: 35, corto: 'G6', sufijo: 'guia6', titulo: 'El Director de Programa' },
    { id: 36, corto: 'G7', sufijo: 'guia7', titulo: 'Ahorra Mientras Esperas' },
  ]

  for (const g of guides) {
    await sql`
      INSERT INTO cor1440_gen_actividadpf (
        id, titulo, "nombrecorto", "sufijoRuta",
        proyectofinanciero_id, resultadopf_id
      ) VALUES (
        ${g.id}, ${g.titulo}, ${g.corto}, ${g.sufijo},
        ${courseId}, ${resultId}
      )
    `.execute(db)
  }

  console.log(`[create-course-es] Created ${guides.length} guides for course ${courseId}`)
}

export async function down(db: Kysely<any>): Promise<void> {
  const course = await db
    .selectFrom('cor1440_gen_proyectofinanciero')
    .select('id')
    .where('prefijoRuta', '=', '/redgd')
    .where('idioma', '=', 'es')
    .executeTakeFirst()

  if (course) {
    await sql`DELETE FROM cor1440_gen_actividadpf WHERE proyectofinanciero_id = ${course.id}`.execute(db)
    await sql`DELETE FROM cor1440_gen_resultadopf WHERE proyectofinanciero_id = ${course.id}`.execute(db)
    await sql`DELETE FROM cor1440_gen_objetivopf WHERE proyectofinanciero_id = ${course.id}`.execute(db)
    await sql`DELETE FROM cor1440_gen_proyectofinanciero WHERE id = ${course.id}`.execute(db)
  }
}
