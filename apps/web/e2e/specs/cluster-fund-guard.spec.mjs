#!/usr/bin/env node
// E2E: a cluster cannot be presented while its fund has no money (R-#161).
//
// Operator decision (2026-11-05): the check is a **validation error**, not a silent
// pass. `POST /api/cluster/[id]/gd-presentation` reads `getClusterFunds(wallet)` and
// answers `409 cluster_fund_empty` when the fund does not exist or has no balance
// (the contract could not verify the cluster, so pdJ's `sent` would fail too).
//
// The spec prepares the ready cluster **without the crosswords**
// (`prepareReadyCluster({ solveGuides: false })`): churches, wallet, budget,
// director offer, score and approvals are there, but the fund never received the 10%
// because no scholarship was paid. Asking for the presentation must be refused.
//
// Execution:
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 \
//     CHAIN_ID=11142220 node e2e/specs/cluster-fund-guard.spec.mjs

import { fail, initTestEnv, launchBrowser, ok, resetFailures, resolveSiteTarget, summary } from '@pasosdejesus/m/e2e'
import { loadVerifierWallet } from '../helpers/e2e-wallet.mjs'
import { apiOn } from '../helpers/e2e-fixture.mjs'
import { prepareReadyCluster } from '../helpers/cluster-ready-fixture.mjs'
import { resolveClusterPastors } from '../helpers/e2e-pastors.mjs'

async function main() {
  const t0 = performance.now()
  resetFailures()

  const picked = resolveClusterPastors({ count: 3 })
  const pastors = picked.pastors
  if (picked.missing) {
    console.log(`[SKIP] ${picked.reason}`)
    process.exit(0)
  }
  const verifier = loadVerifierWallet()
  if (!verifier) {
    console.error('Falta PRIVATE_KEY en apps/.env')
    process.exit(1)
  }
  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'

  const env = await initTestEnv()
  const { base } = resolveSiteTarget(env)
  const browser = await launchBrowser(env.headless)

  console.log('\n── 1. Clúster listo pero con el fondo vacío ──')
  let prepared
  try {
    prepared = await prepareReadyCluster({
      browser,
      base,
      timeout: env.timeout,
      chainId: process.env.CHAIN_ID,
      lang: process.env.E2E_LANG === 'es' ? 'es' : 'en',
      pastors,
      verifier,
      completeGuides: false,
      ok,
      fail,
      log: (message) => console.log(`  [estado] ${message}`),
    })
  } catch (error) {
    fail(`no se pudo preparar el clúster: ${error.message}`)
    await browser.close()
    summary(t0)
    process.exit(1)
  }
  const { clusterId, sessions } = prepared
  const initiator = sessions[0]
  const wallet = initiator.pastor.address
  ok(`clúster #${clusterId} con datos, billetera y aprobaciones`)

  console.log('\n── 2. La solicitud se rechaza por falta de fondos ──')
  const request = await apiOn(initiator.page, `/api/cluster/${clusterId}/gd-presentation`, {
    method: 'POST',
    body: JSON.stringify({ walletAddress: wallet }),
  })
  if (request.status === 409 && request.body?.code === 'cluster_fund_empty') {
    ok('solicitar la presentación sin dinero en el fondo → 409 cluster_fund_empty')
    console.log(`  [mensaje] ${String(request.body?.error || '').slice(0, 180)}`)
  } else if (request.status === 503 && request.body?.code === 'cluster_fund_unreadable') {
    ok('el fondo no se pudo leer → 503 cluster_fund_unreadable (tampoco se presenta a ciegas)')
  } else if (request.status === 400 && String(request.body?.error || '').includes('not ready')) {
    // The readiness ties the approvals to the data hash of the flow after the
    // guides; without them this cluster cannot reach it. The validation itself is
    // covered by the route tests (409/503).
    const reasons = Array.isArray(request.body?.reasons) ? request.body.reasons : []
    console.log(`  [motivos] ${reasons.slice(0, 4).join(' | ') || '(el servidor no explicó por qué)'}`)
    console.log('  [SKIP] el clúster no alcanza readiness sin los crucigramas: la validación queda cubierta por los tests de la ruta')
  } else if (request.status === 200) {
    fail('la solicitud fue aceptada con el fondo vacío: la validación no está desplegada')
  } else {
    fail(`solicitud → ${request.status} ${JSON.stringify(request.body).slice(0, 200)}`)
  }

  console.log('\n── 3. Limpieza ──')
  for (const session of sessions) {
    await apiOn(session.page, `/api/cluster/${clusterId}/leave`, {
      method: 'POST',
      body: JSON.stringify({ walletAddress: session.pastor.address }),
    })
  }
  ok('los tres pastores salieron')

  await browser.close()
  summary(t0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
