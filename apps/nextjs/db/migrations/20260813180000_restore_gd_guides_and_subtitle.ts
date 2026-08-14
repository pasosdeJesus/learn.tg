import { Kysely, sql } from 'kysely'

// Restore Global Disciples course to 6 guides (G1..G6) and update the course
// subtitle/description. Guides 2-6 have no content yet, so their availability
// date is embedded in the title.

const EN_SUBTITLE =
  'Tools for your cluster of churches to apply to the Global Disciples process. ' +
  'Pilot course for people from non-Zionist churches in Sierra Leone and Colombia.'

const ES_SUBTITLE =
  'Herramientas para que tu cluster de iglesias aplique al proceso de Global Disciples. ' +
  'Curso piloto para personas de iglesias no sionistas de Sierra Leona y Colombia.'

// courseId=10 (EN /gdcluster), courseId=11 (ES /redgd)
const enGuides = [
  { id: 21, corto: 'G2', sufijo: 'guide2', titulo: 'Form Your Network of Churches (available 2026-08-20)' },
  { id: 22, corto: 'G3', sufijo: 'guide3', titulo: 'Fund Your Network\'s Mission (available 2026-08-27)' },
  { id: 23, corto: 'G4', sufijo: 'guide4', titulo: 'Sustain and Grow (available 2026-09-03)' },
  { id: 24, corto: 'G5', sufijo: 'guide5', titulo: 'Contact Global Disciples (available 2026-09-10)' },
  { id: 25, corto: 'G6', sufijo: 'guide6', titulo: 'The Program Director (available 2026-09-17)' },
]

const esGuides = [
  { id: 31, corto: 'G2', sufijo: 'guia2', titulo: 'Forma tu Red de Iglesias (disponible 2026-08-20)' },
  { id: 32, corto: 'G3', sufijo: 'guia3', titulo: 'Financia la Misión de tu Red (disponible 2026-08-27)' },
  { id: 33, corto: 'G4', sufijo: 'guia4', titulo: 'Sostén y Crece (disponible 2026-09-03)' },
  { id: 34, corto: 'G5', sufijo: 'guia5', titulo: 'Contacta a Discípulos Globales (disponible 2026-09-10)' },
  { id: 35, corto: 'G6', sufijo: 'guia6', titulo: 'El Director de Programa (disponible 2026-09-17)' },
]

export async function up(db: Kysely<any>): Promise<void> {
  // Update course subtitle/description (EN and ES).
  await sql`
    UPDATE cor1440_gen_proyectofinanciero
    SET "subtitulo" = ${EN_SUBTITLE}, "resumenMd" = ${EN_SUBTITLE}, updated_at = NOW()
    WHERE id = 10
  `.execute(db)

  await sql`
    UPDATE cor1440_gen_proyectofinanciero
    SET "subtitulo" = ${ES_SUBTITLE}, "resumenMd" = ${ES_SUBTITLE}, updated_at = NOW()
    WHERE id = 11
  `.execute(db)

  // Restore guides G2..G6 for the EN course (id=10, resultadopf_id=10).
  for (const g of enGuides) {
    await sql`
      INSERT INTO cor1440_gen_actividadpf (
        id, titulo, "nombrecorto", "sufijoRuta",
        proyectofinanciero_id, resultadopf_id
      ) VALUES (
        ${g.id}, ${g.titulo}, ${g.corto}, ${g.sufijo},
        10, 10
      )
    `.execute(db)
  }

  // Restore guides G2..G6 for the ES course (id=11, resultadopf_id=11).
  for (const g of esGuides) {
    await sql`
      INSERT INTO cor1440_gen_actividadpf (
        id, titulo, "nombrecorto", "sufijoRuta",
        proyectofinanciero_id, resultadopf_id
      ) VALUES (
        ${g.id}, ${g.titulo}, ${g.corto}, ${g.sufijo},
        11, 11
      )
    `.execute(db)
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`
    DELETE FROM cor1440_gen_actividadpf
    WHERE proyectofinanciero_id IN (10, 11)
      AND "nombrecorto" IN ('G2', 'G3', 'G4', 'G5', 'G6')
  `.execute(db)
}
