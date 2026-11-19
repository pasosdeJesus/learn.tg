#!/usr/bin/env node
// Siembra pastores con el curso GD hasta tener `N` libres en el registro local.
//
// Los specs de clúster necesitan un pastor con el curso GD como iniciador
// (`POST /api/cluster` lo exige) y el registro (`apps/.e2e-wallets.local.json`) sólo
// guarda `hasGdCourse` cuando alguien lo compra de verdad. Un clúster que llega a
// `answered` marca a sus tres pastores con `clusterCompletedAt` y ese asiento no se
// vuelve a usar, así que con el tiempo no queda ninguno y los specs se omiten.
//
// Esto compra el curso con el recorrido real de la interfaz, que es el único que
// registra `hasGdCourse`:
//
//   node bin/e2e-seed-course-pastors.mjs 3
//
// Usa `premium-course-checkout` con `FUND_FRESH=1` (mueve USDT de prueba) y se detiene
// en cuanto hay suficientes. Es interactivo por naturaleza: si la compra falla, se
// detiene y dice qué corrió.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const REGISTRY = join(process.cwd(), '..', '.e2e-wallets.local.json')

function freeCoursePastors() {
  try {
    const rows = JSON.parse(readFileSync(REGISTRY, 'utf8'))
    return rows.filter((row) => row.hasGdCourse === true && !row.clusterCompletedAt)
  } catch {
    return []
  }
}

function main() {
  const wanted = Number(process.argv[2] || 3)
  if (!Number.isFinite(wanted) || wanted < 1) {
    console.error('Uso: node bin/e2e-seed-course-pastors.mjs <cuántos pastores con curso>')
    process.exit(2)
  }

  let free = freeCoursePastors()
  console.log(`[seed] pastores con curso GD libres: ${free.length} (objetivo ${wanted})`)
  let attempts = 0
  while (free.length < wanted) {
    attempts += 1
    console.log(`[seed] compra ${attempts}: FUND_FRESH=1 make test-e2e-spec SPEC=premium-course-checkout`)
    const run = spawnSync('make', ['test-e2e-spec', 'SPEC=premium-course-checkout'], {
      cwd: process.cwd(),
      env: { ...process.env, FUND_FRESH: '1' },
      stdio: 'inherit',
    })
    const after = freeCoursePastors()
    if (after.length <= free.length) {
      console.error(
        `[seed] la compra no agregó un pastor con curso (exit ${run.status}). ` +
          'Revisa la salida de premium-course-checkout (fondos, bóveda o sesión).',
      )
      process.exit(1)
    }
    free = after
    console.log(`[seed] ahora hay ${free.length} pastor(es) con curso GD libre(s)`)
  }
  console.log(`[seed] listo: ${free.map((row) => row.address).join(', ')}`)
}

main()
