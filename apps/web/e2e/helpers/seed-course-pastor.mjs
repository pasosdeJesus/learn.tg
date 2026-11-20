// Compra el curso GD por la interfaz hasta tener `wanted` pastores con curso libres.
//
// Lo usan dos llamadores y por eso vive aquí:
//
//   - `bin/e2e-seed-course-pastors.mjs`, a mano, cuando se quiere reponer de antemano.
//   - `resolveClusterPastors` (`e2e/helpers/e2e-pastors.mjs`), **automático**: un spec
//     que necesita un iniciador no debe pedirle al operador que corra otro spec antes
//     (los pastores con curso se gastan al cerrar ciclos y el registro se queda sin
//     ellos).
//
// La compra se hace con el recorrido real (`premium-course-checkout` con
// `FUND_FRESH=1`), que es el único que registra `hasGdCourse` y mueve USDT/SLEARN de
// **prueba** desde la billetera del fixture. Si la compra falla no se insiste en
// bucle: se devuelve `ok: false` y el llamador decide (el spec se omite con un aviso).

import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

const REGISTRY_PATH = path.join(process.cwd(), '..', '.e2e-wallets.local.json')

/** Pastores del registro con el curso GD comprado y sin ciclo cerrado. */
export function freeCoursePastors() {
  try {
    const rows = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'))
    return rows.filter((row) => row.hasGdCourse === true && !row.clusterCompletedAt)
  } catch {
    return []
  }
}

/**
 * Asegura `wanted` pastores con curso. Compra, como mucho, `wanted` veces: un intento
 * que no agrega ninguno se considera fallo (fondos, bóveda o sesión) y se corta.
 *
 * @returns {{ ok: boolean, free: any[], attempts: number, exit?: number|null }}
 */
export function ensureCoursePastors(wanted = 1, { log = console.log } = {}) {
  const target = Math.max(1, Number(wanted) || 1)
  let free = freeCoursePastors()
  let attempts = 0
  while (free.length < target && attempts < target) {
    attempts += 1
    log(
      `  [seed] faltan pastores con el curso GD (${free.length}/${target}): ` +
        `comprando uno — FUND_FRESH=1 make test-e2e-spec SPEC=premium-course-checkout`,
    )
    const run = spawnSync('make', ['test-e2e-spec', 'SPEC=premium-course-checkout'], {
      cwd: process.cwd(),
      env: { ...process.env, FUND_FRESH: '1', E2E_SPEC_DELAY_MS: '0' },
      stdio: 'inherit',
    })
    const after = freeCoursePastors()
    if (after.length <= free.length) {
      log(
        `  [seed] la compra no agregó un pastor con curso (exit ${run.status}): ` +
          'revisa los fondos de la billetera del fixture, la bóveda del curso y la sesión',
      )
      return { ok: false, free, attempts, exit: run.status }
    }
    free = after
    log(`  [seed] ahora hay ${free.length} pastor(es) con el curso GD libre(s)`)
  }
  return { ok: free.length >= target, free, attempts }
}
