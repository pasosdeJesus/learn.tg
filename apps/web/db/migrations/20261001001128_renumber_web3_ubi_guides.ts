import { Kysely } from 'kysely'

// Numeración corrida de las guías del curso Web3 & UBI (EN `/web3-and-ubi`, ES
// `/web3-e-ibu`), decisión del operador del 2026-09-30: se dejan de usar sufijos con
// letra (`guide2b`) y se renumera 1..5.
//
//   guide2b -> guide3 / guia3   ("Cómo Ganar Becas"; en ES además arregla dos defectos:
//                                el archivo era `guia2b.md` mientras la fila decía
//                                `guide2b`, así que el enlace del curso daba 500, y
//                                `guide2b` ordenaba después de `guia4`)
//   guide3  -> guide4 / guia4   ("Reclamar UBI")
//   guide4  -> guide5 / guia5   ("Cambiar cripto por dinero")
//
// Los `id` (`actividadpf_id`) NO cambian: el progreso (`guide_usuario`), las becas y el
// contrato siguen apuntando a las mismas filas. También se actualiza el título de la
// guía 2, que pasa de "instalar una billetera externa" a la billetera de la aplicación
// (R-#270: es la opción por defecto).
//
// Se renombra en orden inverso (4 -> 5, 3 -> 4, 2b -> 3) para no crear duplicados
// transitorios, y cada paso omite la fila que no exista (una base sin el curso no falla).

const COURSES: Array<{
  prefijoRuta: string
  renames: Array<[string, string]>
  walletGuide: { sufijo: string; titulo: string }
}> = [
  {
    prefijoRuta: '/web3-and-ubi',
    renames: [['guide4', 'guide5'], ['guide3', 'guide4'], ['guide2b', 'guide3']],
    walletGuide: { sufijo: 'guide2', titulo: 'Your wallet inside learn.tg' },
  },
  {
    prefijoRuta: '/web3-e-ibu',
    renames: [['guia4', 'guia5'], ['guia3', 'guia4'], ['guide2b', 'guia3']],
    walletGuide: { sufijo: 'guia2', titulo: 'Tu billetera dentro de learn.tg' },
  },
]

export async function up(db: Kysely<any>): Promise<void> {
  for (const course of COURSES) {
    const row = await db
      .selectFrom('cor1440_gen_proyectofinanciero')
      .select('id')
      .where('prefijoRuta', '=', course.prefijoRuta)
      .executeTakeFirst()
    if (!row) {
      console.log(`[renumber-guides] ${course.prefijoRuta}: curso no encontrado, se omite`)
      continue
    }

    for (const [from, to] of course.renames) {
      const guide = await db
        .selectFrom('cor1440_gen_actividadpf')
        .select('id')
        .where('proyectofinanciero_id', '=', row.id)
        .where('sufijoRuta', '=', from)
        .executeTakeFirst()
      if (!guide) {
        console.log(`[renumber-guides] ${course.prefijoRuta}: ${from} no existe, se omite`)
        continue
      }
      await db
        .updateTable('cor1440_gen_actividadpf')
        .set({ sufijoRuta: to, nombrecorto: to })
        .where('id', '=', guide.id)
        .execute()
      console.log(`[renumber-guides] ${course.prefijoRuta}: ${from} -> ${to} (id ${guide.id})`)
    }

    await db
      .updateTable('cor1440_gen_actividadpf')
      .set({ titulo: course.walletGuide.titulo })
      .where('proyectofinanciero_id', '=', row.id)
      .where('sufijoRuta', '=', course.walletGuide.sufijo)
      .execute()
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  for (const course of COURSES) {
    const row = await db
      .selectFrom('cor1440_gen_proyectofinanciero')
      .select('id')
      .where('prefijoRuta', '=', course.prefijoRuta)
      .executeTakeFirst()
    if (!row) continue

    for (const [from, to] of course.renames) {
      const guide = await db
        .selectFrom('cor1440_gen_actividadpf')
        .select('id')
        .where('proyectofinanciero_id', '=', row.id)
        .where('sufijoRuta', '=', to)
        .executeTakeFirst()
      if (!guide) continue
      await db
        .updateTable('cor1440_gen_actividadpf')
        .set({ sufijoRuta: from, nombrecorto: from })
        .where('id', '=', guide.id)
        .execute()
    }

    await db
      .updateTable('cor1440_gen_actividadpf')
      .set({ titulo: course.prefijoRuta === '/web3-and-ubi' ? 'Installing a Web3 wallet' : 'Instalar una billetera Web3' })
      .where('proyectofinanciero_id', '=', row.id)
      .where('sufijoRuta', '=', course.walletGuide.sufijo)
      .execute()
  }
}
