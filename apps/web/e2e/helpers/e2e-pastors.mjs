// Cluster pastors for the E2E, taken from the local registry and created only when
// there is no reusable one (R-#161).
//
// Why: answering Global Disciples completes the churches' cycle for good
// (`cluster_completed`), so a spec that drives a cluster to `answered` **spends** the
// pastors it used. Before, every cluster spec hardcoded `TEST_PASTOR1..3` and the
// first spec that answered one left the others unable to create a cluster. The
// registry (`apps/.e2e-wallets.local.json`) records who owns the GD course
// (`hasGdCourse`) and who already closed the cycle (`clusterCompletedAt`), so:
//
//   - the initiator is a pastor with `hasGdCourse` and no `clusterCompletedAt`
//     (only the initiator needs the course: `POST /api/cluster` checks it),
//   - the other seats take any registered pastor/member not yet completed, and
//     `ensurePastorFixture` gives them a church and the `pastor` role,
//   - when the registry has no seat left, a wallet is created and registered.
//
// Buying the GD course is the one step this helper does not do (it moves test funds
// and needs the real payment flow): when there is no course-owning pastor it reports
// `missing`, and the caller skips with the instruction to create one with
// `FUND_FRESH=1 make test-e2e-spec SPEC=premium-course-checkout`, which buys the
// course for a new wallet and marks it in this same registry.
import { createTestWallet } from './in-app-wallet.mjs'
import { listWallets, markWalletUsed, recentByRole, rememberWallet } from './e2e-wallets-registry.mjs'

function credentials(row) {
  return {
    variable: row.note || row.role,
    pk: row.privateKey,
    address: row.address,
    addr: row.address,
  }
}

/**
 * Picks `count` pastors for a cluster, reusing the registry.
 * @returns {{ pastors: any[], missing: number, reason?: string }}
 */
export function resolveClusterPastors({ count = 3, destructive = false, exclude = [] } = {}) {
  // `exclude`: direcciones que no se deben tomar (los pastores que ya usó otro
  // clúster en la misma corrida, p. ej. el reparto entre A y B).
  // Wallets owned by the other cluster specs are usually still inside a cluster (or
  // just left one): taking them makes the join fail with 409. They are excluded here;
  // the ones this helper creates are marked 'created for a cluster'.
  const ownedByAnotherClusterSpec = /^cluster-(page|ready|flow|three-pastors|funds-once)/
  // El pastor con el curso GD es el recurso escaso (el iniciador): se reutiliza aunque
  // lo haya usado otro spec de clúster, porque cada corrida deja el clúster disuelto o
  // salido. Sin esto, el único pastor con curso del registro quedaba excluido por su
  // nota y todos los specs de tres pastores se omitían (medido 2026-11-18).
  const reusable = (row) => row.hasGdCourse === true || !ownedByAnotherClusterSpec.test(String(row.note || ''))
  const excluded = new Set(exclude.map((address) => String(address).toLowerCase()))
  const free = (row) => !excluded.has(String(row.address).toLowerCase())
  const pastors = recentByRole('pastor', { count: 50 }).filter(reusable).filter(free)
  // A spec that answers GD spends its pastors: it takes the ones reserved for that
  // (role 'pastor-burn') before touching the shared ones, so the rest of the suite
  // keeps a course-owning pastor to work with.
  const burns = recentByRole('pastor-burn', { count: 50 }).filter((row) => !row.clusterCompletedAt).filter(free)
  const pool = destructive ? [...burns, ...pastors] : pastors
  // El curso GD no lo tienen sólo los pastores: `premium-course-checkout` crea la
  // billetera como `member` y el curso se compra ahí mismo. Se buscan los dueños del
  // curso en **todo** el registro (la iglesia y el rol los pone `ensurePastorFixture`).
  const withCourse = listWallets()
    .filter((row) => row.hasGdCourse === true && !row.clusterCompletedAt)
    .filter(reusable)
    .filter(free)
  const courseAddresses = new Set(withCourse.map((row) => String(row.address).toLowerCase()))
  const spendable = pastors.filter(
    (row) => !row.clusterCompletedAt && !courseAddresses.has(String(row.address).toLowerCase()),
  )
  const members = recentByRole('member', { count: 50 })
    .filter((row) => !row.clusterCompletedAt)
    // Un dueño del curso no se usa como puesto suelto: se reserva para el iniciador de
    // otro clúster (cluster-fund-split necesita dos).
    .filter((row) => !courseAddresses.has(String(row.address).toLowerCase()))
    .filter(reusable)
    .filter(free)

  const chosen = []
  if (withCourse.length > 0) chosen.push(withCourse[0])
  // Los pastores con el curso son el recurso escaso (cada clúster necesita uno como
  // iniciador): se gastan como **iniciadores**, no como simples puestos. Por eso los
  // miembros se prueban antes que los demás pastores con curso.
  // Un dueño del curso se gasta sólo como **iniciador** (es el recurso escaso): los
  // demás puestos se cubren con pastores sin curso o con billeteras nuevas, así una
  // corrida que necesita dos clústeres (cluster-fund-split) no se queda sin iniciador.
  for (const pool of [spendable, members]) {
    for (const row of pool) {
      if (chosen.length >= count) break
      if (!chosen.some((entry) => entry.address === row.address)) chosen.push(row)
    }
  }
  while (chosen.length < count) {
    const wallet = createTestWallet()
    const row = rememberWallet({
      privateKey: wallet.privateKey,
      address: wallet.address,
      role: 'member',
      note: 'created for a cluster',
    })
    chosen.push(row)
  }

  const missing = withCourse.length === 0 ? 1 : 0
  return {
    pastors: chosen.slice(0, count).map(credentials),
    missing,
    reason: missing
      ? 'no hay un pastor con el curso GD sin ciclo cerrado en el registro; crea uno con FUND_FRESH=1 make test-e2e-spec SPEC=premium-course-checkout'
      : undefined,
  }
}

/**
 * Marks the pastors whose churches closed the cycle, so the next runs take others
 * instead of failing with `cluster_completed`.
 */
export function markClusterCompleted(addresses) {
  const now = new Date().toISOString()
  for (const address of addresses) {
    markWalletUsed(address, { clusterCompletedAt: now })
  }
}

/** Marks a wallet as owning the GD course (called after a real purchase). */
export function markGdCourse(address) {
  markWalletUsed(address, { hasGdCourse: true })
}
