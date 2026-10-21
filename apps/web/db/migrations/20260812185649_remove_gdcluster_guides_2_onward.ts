import { Kysely, sql } from 'kysely'

// Remove guides 2-7 (G2..G7) from the Global Disciples courses so that only
// Guide 1 is visible. Guides will be released one per week by re-adding them
// (via a new migration) as their content is published.

const enGuides = [
  { id: 21, corto: 'G2', sufijo: 'guide2', titulo: 'Tools to Bring Global Disciples to Your Cluster — Guide 2' },
  { id: 22, corto: 'G3', sufijo: 'guide3', titulo: 'Tools to Bring Global Disciples to Your Cluster — Guide 3' },
  { id: 23, corto: 'G4', sufijo: 'guide4', titulo: 'Tools to Bring Global Disciples to Your Cluster — Guide 4' },
  { id: 24, corto: 'G5', sufijo: 'guide5', titulo: 'Tools to Bring Global Disciples to Your Cluster — Guide 5' },
  { id: 25, corto: 'G6', sufijo: 'guide6', titulo: 'Tools to Bring Global Disciples to Your Cluster — Guide 6' },
  { id: 26, corto: 'G7', sufijo: 'guide7', titulo: 'Tools to Bring Global Disciples to Your Cluster — Guide 7' },
]

const esGuides = [
  { id: 31, corto: 'G2', sufijo: 'guia2', titulo: 'Forma tu Red de Iglesias' },
  { id: 32, corto: 'G3', sufijo: 'guia3', titulo: 'Financia la Misión de tu Red' },
  { id: 33, corto: 'G4', sufijo: 'guia4', titulo: 'Sostén y Crece' },
  { id: 34, corto: 'G5', sufijo: 'guia5', titulo: 'Contacta a Discípulos Globales' },
  { id: 35, corto: 'G6', sufijo: 'guia6', titulo: 'El Director de Programa' },
  { id: 36, corto: 'G7', sufijo: 'guia7', titulo: 'Ahorra Mientras Esperas' },
]

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    DELETE FROM cor1440_gen_actividadpf
    WHERE proyectofinanciero_id IN (10, 11)
      AND "nombrecorto" <> 'G1'
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
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
