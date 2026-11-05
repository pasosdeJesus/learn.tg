#!/usr/bin/env node
// E2E: a cluster cannot receive the Global Disciples funds twice (R-#161,
// https://github.com/pasosdeJesus/learn.tg/issues/161). Planned in REQ §12 as
// `cluster-funds-once.spec.mjs`.
//
// What it drives, with the three pastors and the verifier of `apps/.env`:
//
//   1. a ready cluster (six guides each, budget, director offer and wallet) is
//      approved by its pastors and presented: requested -> under_review -> approved
//      -> sent (the verifier's API);
//   2. the verifier records GD's answer (`answered`): the country fund is split and
//      the cluster fund is released, and the cluster is unverified on chain;
//   3. answering **again** is refused (409): `answered` is terminal, so the fund
//      cannot be released a second time;
//   4. the churches of that cluster cannot create or join another one
//      (`403 cluster_completed`).
//
// The two-cluster part of the plan (answer A, then B, and check that A's wallet does
// not move) needs three more pastors; it prints `[SKIP]` and stays pending, as the
// requirement says.
//
// Execution:
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 \
//     CHAIN_ID=11142220 node e2e/specs/cluster-funds-once.spec.mjs

import { fail, initTestEnv, launchBrowser, ok, resetFailures, resolveSiteTarget, summary } from '@pasosdejesus/m/e2e'
import { loadVerifierWallet } from '../helpers/e2e-wallet.mjs'
import { markClusterCompleted, resolveClusterPastors } from '../helpers/e2e-pastors.mjs'
import { apiOn } from '../helpers/e2e-fixture.mjs'
import { openSession, prepareReadyCluster } from '../helpers/cluster-ready-fixture.mjs'

const LANG = process.env.E2E_LANG === 'es' ? 'es' : 'en'

async function main() {
  const t0 = performance.now()
  resetFailures()

  // Pastors come from the local registry (reuse first, create only when needed);
  // answering GD spends the ones it uses (`cluster_completed` is permanent).
  const picked = resolveClusterPastors({ count: 3, destructive: true })
  const pastors = picked.pastors
  if (picked.missing) {
    console.log(`[SKIP] ${picked.reason}`)
    process.exit(0)
  }
  const verifier = loadVerifierWallet()
  if (pastors.some((p) => !p) || !verifier) {
    console.error('Faltan TEST_PASTOR1..3_PRIVATE_KEY o PRIVATE_KEY en apps/.env')
    process.exit(1)
  }
  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'

  const env = await initTestEnv()
  const { base } = resolveSiteTarget(env)
  const browser = await launchBrowser(env.headless)

  console.log('\n── 1. Clúster listo ──')
  let prepared
  try {
    prepared = await prepareReadyCluster({
      browser,
      base,
      timeout: env.timeout,
      chainId: process.env.CHAIN_ID,
      lang: LANG,
      pastors,
      verifier,
      ok,
      fail,
      log: (message) => console.log(`  [estado] ${message}`),
    })
  } catch (error) {
    // Answering GD completes the churches' cycle (cluster_completed), so this spec
    // consumes the pastor wallets it uses: once they went through it, the ready
    // fixture cannot create another cluster for them. That is a state of the data,
    // not a defect: report it and skip instead of failing (and poisoning the suite).
    let completed = false
    try {
      const session = await openSession(browser, pastors[0], base, env.timeout, process.env.CHAIN_ID)
      const probe = await apiOn(session.page, '/api/cluster', {
        method: 'POST',
        body: JSON.stringify({ walletAddress: pastors[0].address, name: `E2E probe ${Date.now().toString(36)}` }),
      })
      completed = probe.status === 403 && probe.body?.code === 'cluster_completed'
      await session.page.close().catch(() => {})
    } catch {
      completed = false
    }
    if (completed) {
      console.log('[SKIP] los pastores de apps/.env ya cerraron su ciclo (cluster_completed): este spec los consume. Usa TEST_PASTOR distintos con el curso GD o restablece la BD de desarrollo.')
      await browser.close()
      process.exit(0)
    }
    fail(`no se pudo preparar el clúster: ${error.message}`)
    summary(t0)
    await browser.close()
    return
  }
  const { clusterId, sessions, verifierPage } = prepared
  const initiator = sessions[0]
  const wallet = initiator.pastor.address
  const verifierApi = (path, init) =>
    apiOn(
      verifierPage,
      path.includes('?') ? `${path}&wallet=${verifier.address}` : `${path}?wallet=${verifier.address}`,
      init,
    )
  const state = async () =>
    (await apiOn(initiator.page, `/api/cluster/${clusterId}/gd-presentation?walletAddress=${wallet}`)).body || {}
  console.log(`  [info] clúster #${clusterId}`)

  // ── 2. Aprobaciones y presentación ──────────────────────────────────────
  console.log('\n── 2. Aprobaciones y presentación ──')
  for (const session of sessions) {
    const res = await apiOn(session.page, `/api/cluster/${clusterId}/approval`, {
      method: 'POST',
      body: JSON.stringify({ walletAddress: session.pastor.address }),
    })
    if (res.status === 200) ok(`aprobación de ${session.pastor.variable}`)
    else fail(`aprobación de ${session.pastor.variable} → ${res.status} ${JSON.stringify(res.body)}`)
  }

  const requested = await apiOn(initiator.page, `/api/cluster/${clusterId}/gd-presentation`, {
    method: 'POST',
    body: JSON.stringify({ walletAddress: wallet }),
  })
  if (requested.status === 200) ok('el iniciador solicitó la presentación')
  else fail(`solicitud → ${requested.status} ${JSON.stringify(requested.body)}`)

  for (const status of ['under_review', 'approved', 'sent']) {
    const res = await verifierApi(`/api/cluster/${clusterId}/gd-presentation`, {
      method: 'PUT',
      body: JSON.stringify({ walletAddress: verifier.address, status }),
    })
    if (res.status === 200) ok(`el verificador movió la presentación a ${status}`)
    else fail(`PUT ${status} → ${res.status} ${JSON.stringify(res.body)}`)
  }
  const sent = await state()
  if (sent.request?.status === 'sent') ok('la presentación quedó en sent')
  else fail(`estado tras enviar: ${sent.request?.status}`)

  // ── 3. GD responde: se reparte el país y se libera el fondo ─────────────
  console.log('\n── 3. Respuesta de GD ──')
  const answered = await verifierApi(`/api/cluster/${clusterId}/gd-presentation`, {
    method: 'PUT',
    body: JSON.stringify({
      walletAddress: verifier.address,
      status: 'answered',
      response: 'E2E: Global Disciples accepted this cluster',
      contactEmail: 'director@example.org',
    }),
  })
  if (answered.status === 200) {
    ok('el verificador registró la respuesta de GD')
    // Their churches closed the cycle: the registry must not offer them again.
    markClusterCompleted(pastors.map((pastor) => pastor.address))
  }
  else fail(`PUT answered → ${answered.status} ${JSON.stringify(answered.body)}`)

  const release = answered.body?.release
  if (release?.release) ok(`fondo del clúster liberado (${String(release.release).slice(0, 12)}…)`)
  else if (release?.errors?.length) {
    // No balance yet is a valid state (the course vault and the 10% may still be
    // empty); the failure must be recorded for the operator, never silent.
    for (const error of release.errors) console.log(`  [aviso] ${error}`)
    console.log('  [aviso] sin saldo para liberar; el fallo queda en admin_solves (gd_release_failed)')
  } else {
    fail('la respuesta no trae ni liberación ni motivos')
  }
  if (release?.distribution) ok(`fondo del país repartido (${String(release.distribution).slice(0, 12)}…)`)

  // ── 4. Una segunda respuesta no vuelve a liberar ─────────────────────────
  console.log('\n── 4. Segunda respuesta ──')
  const again = await verifierApi(`/api/cluster/${clusterId}/gd-presentation`, {
    method: 'PUT',
    body: JSON.stringify({ walletAddress: verifier.address, status: 'answered', response: 'again' }),
  })
  if (again.status === 409) ok('responder otra vez se rechaza (409): answered es terminal')
  else fail(`una segunda respuesta devolvió ${again.status} ${JSON.stringify(again.body)}`)

  // ── 5. Las iglesias del clúster no vuelven a empezar ────────────────────
  console.log('\n── 5. La iglesia no repite el proceso ──')
  const rejoin = await apiOn(initiator.page, '/api/cluster', {
    method: 'POST',
    body: JSON.stringify({ walletAddress: wallet, name: `E2E otra vez ${Date.now().toString(36)}` }),
  })
  if (rejoin.status === 403 && rejoin.body?.code === 'cluster_completed') {
    ok('crear otro clúster con la misma iglesia → 403 cluster_completed')
  } else {
    fail(`crear otro clúster devolvió ${rejoin.status} ${JSON.stringify(rejoin.body)}`)
  }

  console.log('\n── 6. Plan con dos clústeres ──')
  console.log('  [pendiente] el reparto entre dos clústeres presentados (A y luego B) necesita tres pastores más (REQ §12)')

  await browser.close()
  summary(t0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
