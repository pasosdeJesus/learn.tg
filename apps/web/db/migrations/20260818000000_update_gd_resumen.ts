import { Kysely, sql } from 'kysely'

// Update the Global Disciples course description (resumenMd) with the fuller
// explanation used on the pastors landing page. courseId=10 (EN /gdcluster),
// courseId=11 (ES /redgd).

const EN_RESUMEN =
  'Prepare your church to apply to the Global Disciples process, who help ' +
  'economically and with training so that your network of churches forms a ' +
  'self-sustaining academy of "Discipleship" and "Small Business Development," ' +
  'that trains leaders, missionary church planters, and pastors who can sustain ' +
  'themselves economically and share the gospel with the unreached. This course ' +
  'prepares you to start the process and is also a tool to raise the initial ' +
  'funds required.'

const ES_RESUMEN =
  'Prepara a tu iglesia para aplicar al proceso de Discípulos Globales quienes ' +
  'ayudan económicamente y con formación para que tu red de iglesias conforme ' +
  'una academia autosostenible de "Discipulado" y de "Desarrollo de Pequeños ' +
  'Negocios," que forme líderes, misioneros plantadores de iglesias y pastores ' +
  'que puedan sostenerse económicamente y compartir el evangelio con los no ' +
  'alcanzados. Este curso te prepara para iniciar el proceso y es a su vez ' +
  'herramienta para levantar los fondos iniciales que se requieren.'

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
