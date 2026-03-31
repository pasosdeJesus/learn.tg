import { newKyselyPostgresql } from '../.config/kysely.config'
import { sql } from 'kysely'

async function diagnoseUser(userId: number) {
  const db = newKyselyPostgresql()
  try {
    // 1. Obtener usuario y su learningscore actual
    const user = await db.selectFrom('usuario')
      .where('id', '=', userId as any)
      .select(['id', 'learningscore'])
      .executeTakeFirst()

    console.log(`\n=== DIAGNÓSTICO USUARIO ${userId} ===`)
    console.log(`Learningscore actual: ${user?.learningscore}`)

    // 2. Calcular gPoints: suma de points de guide_usuario
    const gPointsResult = await db.selectFrom('guide_usuario')
      .where('usuario_id', '=', userId as any)
      .select(db.fn.sum('points').as('total'))
      .executeTakeFirst()
    const gPoints = Number(gPointsResult?.total) || 0
    console.log(`Total points de guide_usuario: ${gPoints}`)

    // 3. Calcular dAmt: suma de cantidad de transacciones tipo 'donation'
    const dAmtResult = await db.selectFrom('transaction')
      .where('usuario_id', '=', userId as any)
      .where('tipo', '=', 'donation')
      .select(db.fn.sum('cantidad').as('total'))
      .executeTakeFirst()
    const dAmt = Number(dAmtResult?.total) || 0
    console.log(`Total donaciones (cantidad): ${dAmt}`)

    // 4. Calcular puntos de donaciones según fórmula: (dAmt * 22) / 10
    const donationPoints = (dAmt * 22) / 10
    console.log(`Puntos calculados de donaciones: ${donationPoints}`)

    // 5. Calcular justified = gPoints + donationPoints
    const justified = gPoints + donationPoints
    console.log(`Score justificado (gPoints + donationPoints): ${justified}`)

    // 6. Sumar impacto_balance de transacciones learningpoints
    const lpResult = await db.selectFrom('transaction')
      .where('usuario_id', '=', userId as any)
      .where('crypto', '=', 'learningpoints')
      .select(db.fn.sum('impacto_balance').as('total'))
      .executeTakeFirst()
    const lpTotal = Number(lpResult?.total) || 0
    console.log(`Suma de impacto_balance (learningpoints): ${lpTotal}`)

    // 7. Listar transacciones learningpoints para ver detalle
    const lpTransactions = await db.selectFrom('transaction')
      .where('usuario_id', '=', userId as any)
      .where('crypto', '=', 'learningpoints')
      .select(['id', 'cantidad', 'impacto_balance', 'tipo', 'metadata'])
      .execute()

    console.log(`\nTransacciones learningpoints (${lpTransactions.length}):`)
    lpTransactions.forEach((tx, i) => {
      console.log(`  ${i+1}. ID: ${tx.id}, cantidad: ${tx.cantidad}, impacto: ${tx.impacto_balance}, tipo: ${tx.tipo}, metadata: ${JSON.stringify(tx.metadata)}`)
    })

    // 8. Listar transacciones donation
    const donationTransactions = await db.selectFrom('transaction')
      .where('usuario_id', '=', userId as any)
      .where('tipo', '=', 'donation')
      .select(['id', 'cantidad', 'crypto', 'hash', 'metadata'])
      .execute()

    console.log(`\nTransacciones donation (${donationTransactions.length}):`)
    donationTransactions.forEach((tx, i) => {
      console.log(`  ${i+1}. ID: ${tx.id}, cantidad: ${tx.cantidad}, crypto: ${tx.crypto}, hash: ${tx.hash}`)
    })

    // 9. Listar guide_usuario entries
    const guideEntries = await db.selectFrom('guide_usuario')
      .where('usuario_id', '=', userId as any)
      .select(['actividadpf_id', 'points', 'amountpaid'])
      .execute()

    console.log(`\nEntradas guide_usuario (${guideEntries.length}):`)
    guideEntries.forEach((g, i) => {
      console.log(`  ${i+1}. Guía ID: ${g.actividadpf_id}, points: ${g.points}, amountpaid: ${g.amountpaid}`)
    })

    // 10. Diferencia entre lpTotal y justified
    console.log(`\nDiferencias:`)
    console.log(`  learningscore - justified: ${Number(user?.learningscore) - justified}`)
    console.log(`  learningscore - lpTotal: ${Number(user?.learningscore) - lpTotal}`)
    console.log(`  lpTotal - justified: ${lpTotal - justified}`)

  } finally {
    await db.destroy()
  }
}

async function main() {
  const args = process.argv.slice(2)
  const userIds = args.length > 0 ? args.map(id => parseInt(id, 10)) : [102, 106]

  for (const userId of userIds) {
    await diagnoseUser(userId)
  }
}

main().catch(console.error)