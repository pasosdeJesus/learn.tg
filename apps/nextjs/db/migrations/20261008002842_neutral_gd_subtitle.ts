import { Kysely, sql } from 'kysely'

// R-#283: the GD course subtitle announced the "non-Zionist" condition on a
// public surface (`GET /api/course-catalog` is anonymous). The condition still
// gates the purchase (`canPurchaseGDCourse`, reason `gd_non_zionist`) and the
// course page only renders for eligible users, but it is no longer announced in
// the course subtitle. courseId=10 (EN /gdcluster), courseId=11 (ES /redgd).

const EN_SUBTITLE =
  'Tools for your cluster of churches to apply to the Global Disciples process.'
const ES_SUBTITLE =
  'Herramientas para que tu cluster de iglesias aplique al proceso de Global Disciples.'

const EN_PREVIOUS =
  'Tools for your cluster of churches to apply to the Global Disciples process. ' +
  'Pilot course for people from non-Zionist churches in Sierra Leone and Colombia.'
const ES_PREVIOUS =
  'Herramientas para que tu cluster de iglesias aplique al proceso de Global Disciples. ' +
  'Curso piloto para personas de iglesias no sionistas de Sierra Leona y Colombia.'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    UPDATE cor1440_gen_proyectofinanciero
    SET subtitulo = ${EN_SUBTITLE}, updated_at = NOW()
    WHERE id = 10
  `.execute(db)

  await sql`
    UPDATE cor1440_gen_proyectofinanciero
    SET subtitulo = ${ES_SUBTITLE}, updated_at = NOW()
    WHERE id = 11
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`
    UPDATE cor1440_gen_proyectofinanciero
    SET subtitulo = ${EN_PREVIOUS}, updated_at = NOW()
    WHERE id = 10
  `.execute(db)

  await sql`
    UPDATE cor1440_gen_proyectofinanciero
    SET subtitulo = ${ES_PREVIOUS}, updated_at = NOW()
    WHERE id = 11
  `.execute(db)
}
