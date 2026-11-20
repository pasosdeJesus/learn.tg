#!/usr/bin/env node
// Siembra pastores con el curso GD hasta tener `N` libres en el registro local.
//
// Los specs de clúster necesitan un pastor con el curso GD como iniciador
// (`POST /api/cluster` lo exige) y el registro (`apps/.e2e-wallets.local.json`) sólo
// guarda `hasGdCourse` cuando alguien lo compra de verdad. Un clúster que llega a
// `answered` marca a sus tres pastores con `clusterCompletedAt` y ese asiento no se
// vuelve a usar, así que con el tiempo no queda ninguno.
//
// Este comando es el atajo manual; los specs ya se reparan solos
// (`resolveClusterPastors` llama a la misma función cuando no encuentra iniciador), así
// que no hace falta correrlo antes de la suite:
//
//   node bin/e2e-seed-course-pastors.mjs 3
//
// Compra con el recorrido real de la interfaz (`premium-course-checkout` con
// `FUND_FRESH=1`, que mueve USDT/SLEARN de prueba) y se detiene cuando hay suficientes.
import { ensureCoursePastors, freeCoursePastors } from '../e2e/helpers/seed-course-pastor.mjs'

const wanted = Number(process.argv[2] || 3)
if (!Number.isFinite(wanted) || wanted < 1) {
  console.error('Uso: node bin/e2e-seed-course-pastors.mjs <cuántos pastores con curso>')
  process.exit(2)
}

const before = freeCoursePastors()
console.log(`[seed] pastores con curso GD libres: ${before.length} (objetivo ${wanted})`)
if (before.length >= wanted) {
  console.log(`[seed] listo: ${before.map((row) => row.address).join(', ')}`)
  process.exit(0)
}

const result = ensureCoursePastors(wanted)
if (!result.ok) {
  console.error(`[seed] no se alcanzó el objetivo (${result.free.length}/${wanted})`)
  process.exit(1)
}
console.log(`[seed] listo: ${result.free.map((row) => row.address).join(', ')}`)
