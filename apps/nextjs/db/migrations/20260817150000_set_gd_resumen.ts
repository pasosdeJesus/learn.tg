import { Kysely, sql } from 'kysely'

// Set the Global Disciples course summary (resumenMd). Title and subtitle are
// left untouched. courseId=10 (EN /gdcluster), courseId=11 (ES /redgd).

const EN_RESUMEN =
  'Prepare your church to apply to the Global Disciples process. ' +
  'This course guides you to form and fund, within your network of churches, ' +
  'a self-sustaining "academy" that trains leaders, missionaries, church ' +
  'planters, and self-supporting pastors. You will discover the full content, ' +
  'the tools, and the benefits we provide once you pay for the course.'

const ES_RESUMEN =
  'Prepara a tu iglesia para aplicar al proceso de Discípulos Globales. ' +
  'Este curso te guía para formar y financiar, en tu red de iglesias, una ' +
  '"academia" autosostenible que forme líderes, misioneros, plantadores de ' +
  'iglesias y pastores que se sostengan a sí mismos. El contenido completo, ' +
  'las herramientas y ventajas que proveemos las descubrirás al pagar el curso.'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    UPDATE cor1440_gen_proyectofinanciero
    SET "resumenMd" = ${EN_RESUMEN}, updated_at = NOW()
    WHERE id = 10
  `.execute(db)

  await sql`
    UPDATE cor1440_gen_proyectofinanciero
    SET "resumenMd" = ${ES_RESUMEN}, updated_at = NOW()
    WHERE id = 11
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`
    UPDATE cor1440_gen_proyectofinanciero
    SET "resumenMd" = '', updated_at = NOW()
    WHERE id IN (10, 11)
  `.execute(db)
}
