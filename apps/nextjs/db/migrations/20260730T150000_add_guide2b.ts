import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  for (const prefijo of ['/web3-and-ubi', '/web3-e-ibu']) {
    const course = await db
      .selectFrom('cor1440_gen_proyectofinanciero')
      .select('id')
      .where('prefijoRuta', '=', prefijo)
      .executeTakeFirst()

    if (!course) {
      console.log(`Course ${prefijo} not found — skipping`)
      continue
    }

    const existing = await db
      .selectFrom('cor1440_gen_actividadpf')
      .select('id')
      .where('proyectofinanciero_id', '=', course.id)
      .where('sufijoRuta', '=', 'guide2b')
      .executeTakeFirst()

    if (existing) {
      // Update nombrecorto if needed (from '25' to 'guide2b')
      if (existing.nombrecorto !== 'guide2b') {
        await db
          .updateTable('cor1440_gen_actividadpf')
          .set({ nombrecorto: 'guide2b' })
          .where('id', '=', existing.id)
          .execute()
        console.log(`Updated nombrecorto to guide2b for ${prefijo}`)
      } else {
        console.log(`guide2b already exists for ${prefijo} — skipping`)
      }
      continue
    }

    await db
      .insertInto('cor1440_gen_actividadpf')
      .values({
        proyectofinanciero_id: course.id,
        nombrecorto: 'guide2b',
        titulo: prefijo === '/web3-and-ubi'
          ? 'How to Earn Scholarships on learn.tg'
          : 'Cómo Ganar Becas en learn.tg',
        sufijoRuta: 'guide2b',
      })
      .execute()

    console.log(`Inserted guide2b for ${prefijo} (course ${course.id})`)
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  for (const prefijo of ['/web3-and-ubi', '/web3-e-ibu']) {
    const course = await db
      .selectFrom('cor1440_gen_proyectofinanciero')
      .select('id')
      .where('prefijoRuta', '=', prefijo)
      .executeTakeFirst()

    if (!course) continue

    await db
      .deleteFrom('cor1440_gen_actividadpf')
      .where('proyectofinanciero_id', '=', course.id)
      .where('sufijoRuta', '=', 'guide2b')
      .execute()
  }
}
