#!/usr/bin/env node
// E2E: dejar un clúster listo para presentarse a Global Disciples, todo por la
// interfaz y sin semilla SQL (R-#161). La preparación vive en
// `e2e/helpers/cluster-ready-fixture.mjs` porque `cluster-flow.spec.mjs` la reutiliza.
//
// Ejecución:
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 \
//   CHAIN_ID=11142220 node e2e/specs/cluster-ready.spec.mjs

import { fail, initTestEnv, launchBrowser, ok, resetFailures, resolveSiteTarget, summary } from '@pasosdejesus/m/e2e'
import { loadVerifierWallet, loadWalletCredentials } from '../helpers/e2e-wallet.mjs'
import { prepareReadyCluster } from '../helpers/cluster-ready-fixture.mjs'
import { apiOn } from '../helpers/e2e-fixture.mjs'

const LANG = process.env.E2E_LANG === 'es' ? 'es' : 'en'

async function main() {
  const t0 = performance.now()
  resetFailures()

  const pastors = [1, 2, 3].map((n) => loadWalletCredentials({ variable: `TEST_PASTOR${n}` }))
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
  console.log(`Pastores: ${pastors.map((p) => p.address.slice(0, 8)).join(', ')} | ${base}`)

  const browser = await launchBrowser(env.headless)
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
    fail(`no se pudo preparar el clúster: ${error.message}`)
    summary()
    await browser.close()
    return
  }

  const { clusterId, sessions, ready } = prepared
  const body = ready || {}
  if (body.ready === true && (body.missing || []).length === 0 && (body.missing_data || []).length === 0) {
    ok('el clúster está listo para presentarse')
  } else {
    fail(`todavía no está listo: ${JSON.stringify({ missing: body.missing, missing_data: body.missing_data })}`)
  }

  console.log('\n── Limpieza ──')
  for (const session of sessions) {
    await apiOn(session.page, `/api/cluster/${clusterId}/leave`, {
      method: 'POST',
      body: JSON.stringify({ walletAddress: session.pastor.address }),
    })
  }
  ok('los tres pastores salieron')

  await browser.close()
  console.log(`\nDuración: ${((performance.now() - t0) / 1000).toFixed(1)}s`)
  summary()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
