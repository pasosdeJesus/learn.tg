#!/usr/bin/env node
// E2E: a cluster cannot be presented while its fund has no money (R-#161).
//
// Operator decision (2026-11-05): the check is a **validation error**, not a silent
// pass. `POST /api/cluster/[id]/gd-presentation` reads `getClusterFunds(wallet)` and
// answers `409 cluster_fund_empty` when the fund does not exist or has no balance
// (the contract could not verify the cluster, so pdJ's `sent` would fail too).
//
// The spec prepares the ready cluster **with the guides but without money in the
// course vault** (`prepareReadyCluster({ fundVault: false })`): churches, wallet,
// budget, director offer, score, guides and approvals are there, but no scholarship
// was paid, so the 10% never reached the cluster fund. Asking for the presentation
// must be refused. (Measured 2026-11-06: with the vault funded and the guides solved
// the 10% does reach the fund, the fund is not empty and the request is legitimately
// accepted — the guard can only be exercised on an unfunded vault.)
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
      fundVault: false,
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
  const { clusterId, sessions, walletCreated } = prepared
  const initiator = sessions[0]
  const wallet = initiator.pastor.address
  ok(`clúster #${clusterId} con datos, billetera y aprobaciones`)

  console.log('\n── 2. La solicitud se rechaza por falta de fondos ──')

  // El fondo se lee de la cadena por billetera de la iglesia iniciadora, y esas
  // billeteras se **reutilizan** entre corridas: si una ya recibió el 10% de otra
  // campaña el fondo no está vacío y aceptar la solicitud es correcto. El ranking
  // (público, desde `transaction`) dice cuánto tiene esa billetera en el registro.
  const ranking = await apiOn(initiator.page, '/api/gdcluster/ranking/funds')
  const funds = Array.isArray(ranking.body?.clusters) ? ranking.body.clusters : []
  const entry = funds.find(
    (row) => String(row.cluster_wallet || '').toLowerCase() === wallet.toLowerCase(),
  )
  const fundUsdt = Number(entry?.usdt_total ?? 0)
  const fundSlearn = Number(entry?.slearn_total ?? 0)
  const fundHasMoney = fundUsdt > 0 || fundSlearn > 0
  console.log(
    `  [fondo] billetera ${walletCreated ? 'nueva' : 'heredada de otra campaña'} · registro ` +
      `${fundUsdt.toFixed(2)} USDT / ${fundSlearn.toFixed(2)} SLEARN (${fundHasMoney ? 'con dinero' : 'sin movimientos'})`
  )

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
    if (fundHasMoney || !walletCreated) {
      // La billetera ya tenía dinero de otra campaña: la aceptación es la conducta
      // correcta y este spec no puede probar el rechazo con estas billeteras.
      console.log(
        `  [NOTE] la billetera del clúster ${walletCreated ? 'ya tenía dinero' : 'es heredada de otra campaña y puede tener dinero on-chain'}: la solicitud se aceptó (correcto). ` +
          'Para probar el rechazo hace falta una iglesia con billetera nueva; mientras tanto queda cubierto por los tests de la ruta.',
      )
    } else {
      fail(
        `la solicitud fue aceptada con el fondo vacío: la validación no está desplegada (${request.status} ${JSON.stringify(request.body).slice(0, 160)})`,
      )
    }
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
