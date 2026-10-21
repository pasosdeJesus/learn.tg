// Recalcula `usuario.profilescore` de todas las cuentas habilitadas con la **regla
// canónica** (`lib/score-rules.ts`, la misma que usa `lib/gd-utils.recalculateProfileScore`).
//
// R-#286 §5: reemplaza `bin/recalc-all-scores.mjs`, que duplicaba la fórmula y
// seleccionaba columnas eliminadas por
// `20260810000000_drop_department_municipality_from_usuario` (por eso fallaba).
//
// Uso: cd apps/web && node scripts/recalc-all-scores.ts
// Se corre con `node` simple (Node ≥ 22.18 quita los tipos solo); no importa `viem`,
// así que `tsx` no hace falta.

import { newKyselyPostgresql } from '../.config/kysely-db.ts'
import { ALL_SCORE_FIELDS, SCORE_RULES } from '../lib/score-rules.ts'

async function main() {
  const db = newKyselyPostgresql()

  const users = (await db
    .selectFrom('usuario')
    .where('fechadeshabilitacion', 'is', null)
    .select(['id', 'nusuario', 'profilescore', ...ALL_SCORE_FIELDS] as never)
    .orderBy('id')
    .execute()) as unknown as Record<string, unknown>[]

  let updated = 0
  for (const user of users) {
    let score = 0
    for (const rule of SCORE_RULES) {
      if (rule.check(user)) score += rule.points
    }
    if ((Number(user.profilescore) || 0) !== score) {
      await db
        .updateTable('usuario')
        .set({ profilescore: score, updated_at: new Date() })
        .where('id', '=', user.id as number)
        .execute()
      updated++
      console.log(`  ${user.nusuario || user.id}: ${user.profilescore ?? 'null'} -> ${score}`)
    }
  }

  console.log(`\n${updated}/${users.length} cuentas actualizadas.`)
  await db.destroy()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
