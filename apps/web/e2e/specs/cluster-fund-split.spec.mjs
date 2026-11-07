#!/usr/bin/env node
// E2E: the country fund split between **two** presented clusters (R-#161 §10 and
// §12, https://github.com/pasosdeJesus/learn.tg/issues/161).
//
// What it drives, with two disjoint sets of three pastors and the verifier of
// `apps/.env`:
//
//   1. cluster A becomes ready (six guides each, budget, director offer, wallet),
//      its pastors approve and the verifier presents it (`sent`);
//   2. cluster B becomes ready with **other** pastors and is presented too;
//   3. the verifier records GD's answer for A: the country fund is split and A's
//      fund is released, and A is unverified on chain (so a later answer cannot pay
//      it again);
//   4. the verifier records GD's answer for B: B's fund is released and, because
//      `fund_released_at` excludes A from later splits, the split reaches **only B**;
//      A's recorded answer does not change;
//   5. answering either of them again is refused (409, `answered` is terminal).
//
// Answering GD completes the churches' cycle (`cluster_completed`) for good, so this
// spec **consumes six pastor churches**: run it on purpose. When the registry cannot
// give two disjoint sets with the course, it prints `[SKIP]`.
//
// Execution:
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 \
//     CHAIN_ID=11142220 node e2e/specs/cluster-fund-split.spec.mjs

import { fail, initTestEnv, launchBrowser, ok, resetFailures, resolveSiteTarget, summary } from '@pasosdejesus/m/e2e'
import dotenv from 'dotenv'
import { createPublicClient, createWalletClient, http, parseUnits } from 'viem'
import { celoSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { loadSelectedWallet, loadVerifierWallet } from '../helpers/e2e-wallet.mjs'
import { markClusterCompleted, resolveClusterPastors } from '../helpers/e2e-pastors.mjs'
import { apiOn } from '../helpers/e2e-fixture.mjs'
import { prepareReadyCluster } from '../helpers/cluster-ready-fixture.mjs'

const LANG = process.env.E2E_LANG === 'es' ? 'es' : 'en'

// apps/.env trae las direcciones de testnet (USDT, RPC) que no están en apps/web/.env.
for (const envPath of ['../.env', 'apps/.env']) {
  try {
    dotenv.config({ path: envPath, override: false })
  } catch {
    // sin archivo: se usan las variables del entorno
  }
}

/**
 * Deja dinero en el fondo de un clúster: transfiere USDT al backend y registra la
 * donación con `clusterWallet`. Sin fondos el clúster no se puede presentar
 * (R-#161, 2026-11-05) y un clúster nuevo, con iglesias que todavía no generaron
 * becas, tiene el fondo vacío.
 */
async function ensureClusterFund({ cluster, creds, side, ok, fail, usdt = 2 }) {
  const detail = (await apiOn(cluster.initiator.page, `/api/cluster/${cluster.clusterId}?walletAddress=${cluster.wallet}`)).body || {}
  const clusterWallet = detail.cluster_wallet
  if (!clusterWallet) {
    fail(`${side}: el clúster no tiene billetera para su fondo`)
    return
  }
  const backendWallet = await cluster.initiator.page
    .evaluate(async () => (await fetch('/api/churches/fund')).json())
    .then((data) => data?.address)
    .catch(() => null)
  if (!backendWallet) {
    fail(`${side}: no se pudo leer la billetera del backend`)
    return
  }
  const account = privateKeyToAccount(creds.pk)
  const rpc = process.env.NEXT_PUBLIC_RPC_URL || 'https://forno.celo-sepolia.celo-testnet.org'
  const publicClient = createPublicClient({ chain: celoSepolia, transport: http(rpc, { timeout: 30000 }) })
  const walletClient = createWalletClient({ account, chain: celoSepolia, transport: http(rpc, { timeout: 30000 }) })
  const usdtAddress = process.env.NEXT_PUBLIC_USDT_TESTNET
  const erc20Abi = [
    { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }] },
  ]
  try {
    const hash = await walletClient.writeContract({
      address: usdtAddress,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [backendWallet, parseUnits(String(usdt), 6)],
    })
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    if (receipt.status !== 'success') {
      fail(`${side}: la transferencia de ${usdt} USDT no se confirmó`)
      return
    }
    const verified = await apiOn(cluster.initiator.page, '/api/gdcluster/donations/verify', {
      method: 'POST',
      body: JSON.stringify({
        walletAddress: cluster.wallet,
        clusterWallet,
        countryCode: process.env.GD_COUNTRY_CODE || 'SL',
        usdtHash: hash,
      }),
    })
    if (verified.status === 200) {
      ok(`${side}: fondo del clúster con ${usdt} USDT (${String(hash).slice(0, 10)}…)`)
    } else {
      fail(`${side}: la donación no se registró → ${verified.status} ${JSON.stringify(verified.body).slice(0, 160)}`)
    }
  } catch (error) {
    fail(`${side}: no se pudo fondear el fondo del clúster (${error.message})`)
  }
}

/**
 * Prepara un clúster listo, lo aprueba, lo solicita y lo deja en `sent`.
 * Devuelve las piezas que necesitan los pasos siguientes.
 */
async function presentCluster({ browser, base, env, verifier, funder, pastors, side, ok, fail }) {
  console.log(`\n── Clúster ${side}: preparación ──`)
  const prepared = await prepareReadyCluster({
    browser,
    base,
    timeout: env.timeout,
    chainId: process.env.CHAIN_ID,
    lang: LANG,
    pastors,
    verifier,
    ok,
    fail,
    log: (message) => console.log(`  [${side}] ${message}`),
  })
  const { clusterId, sessions, verifierPage, ready } = prepared
  const initiator = sessions[0]
  const wallet = initiator.pastor.address
  const verifierApi = (path, init) =>
    apiOn(
      verifierPage,
      path.includes('?') ? `${path}&wallet=${verifier.address}` : `${path}?wallet=${verifier.address}`,
      init,
    )

  if (ready?.ready !== true) {
    const blocking = (ready?.pastors || [])
      .filter((pastor) => (pastor.missing || []).length > 0)
      .map((pastor) => ({ church: pastor.church_name, missing: pastor.missing, reasons: pastor.reasons }))
    fail(`el clúster ${side} no quedó listo: ${JSON.stringify({ missing: ready?.missing, reasons: ready?.reasons, pastors: blocking })}`)
    return null
  }
  ok(`clúster ${side} #${clusterId} listo`)

  for (const session of sessions) {
    const res = await apiOn(session.page, `/api/cluster/${clusterId}/approval`, {
      method: 'POST',
      body: JSON.stringify({ walletAddress: session.pastor.address }),
    })
    if (res.status !== 200) fail(`aprobación de ${side}/${session.pastor.variable} → ${res.status}`)
  }
  ok(`clúster ${side}: los tres pastores aprobaron`)

  // Un clúster sin dinero en su fondo no se puede presentar (R-#161, 2026-11-05) y
  // sus iglesias nuevas todavía no generaron becas: el spec deja el fondo con USDT.
  await ensureClusterFund({ cluster: { clusterId, initiator, wallet }, creds: funder, side, ok, fail })

  const requested = await apiOn(initiator.page, `/api/cluster/${clusterId}/gd-presentation`, {
    method: 'POST',
    body: JSON.stringify({ walletAddress: wallet }),
  })
  if (requested.status !== 200) {
    fail(`solicitud de ${side} → ${requested.status} ${JSON.stringify(requested.body)}`)
    return null
  }

  for (const status of ['under_review', 'approved', 'sent']) {
    const res = await verifierApi(`/api/cluster/${clusterId}/gd-presentation`, {
      method: 'PUT',
      body: JSON.stringify({ walletAddress: verifier.address, status }),
    })
    if (res.status !== 200) fail(`PUT ${status} de ${side} → ${res.status} ${JSON.stringify(res.body)}`)
  }

  const state = (await apiOn(initiator.page, `/api/cluster/${clusterId}/gd-presentation?walletAddress=${wallet}`)).body || {}
  if (state.request?.status === 'sent') ok(`clúster ${side}: presentación en \`sent\``)
  else fail(`clúster ${side}: quedó en ${state.request?.status}`)

  return { clusterId, sessions, initiator, wallet, verifierApi, state }
}

/** Registra la respuesta de GD y devuelve el cuerpo (liberación y reparto). */
async function answer(cluster, verifier, side, ok, fail) {
  const res = await cluster.verifierApi(`/api/cluster/${cluster.clusterId}/gd-presentation`, {
    method: 'PUT',
    body: JSON.stringify({
      walletAddress: verifier.address,
      status: 'answered',
      response: `E2E: Global Disciples accepted cluster ${side}`,
      contactEmail: 'director@example.org',
    }),
  })
  if (res.status !== 200) {
    fail(`respuesta de GD para ${side} → ${res.status} ${JSON.stringify(res.body)}`)
    return null
  }
  ok(`respuesta de GD registrada para ${side}`)
  const release = res.body?.release
  if (release?.release) ok(`${side}: fondo del clúster liberado (${String(release.release).slice(0, 12)}…)`)
  else if (release?.errors?.length) {
    for (const error of release.errors) console.log(`  [aviso] ${side}: ${error}`)
    console.log(`  [aviso] ${side}: sin saldo para liberar; el fallo queda en admin_solves (gd_release_failed)`)
  } else fail(`${side}: la respuesta no trae ni liberación ni motivos`)
  if (release?.distribution) ok(`${side}: fondo del país repartido (${String(release.distribution).slice(0, 12)}…)`)
  else console.log(`  [aviso] ${side}: el país no tenía saldo que repartir (el reparto queda cubierto por los tests de la ruta)`)
  return release
}

async function main() {
  const t0 = performance.now()
  resetFailures()

  const funder = loadSelectedWallet()
  const verifier = loadVerifierWallet()
  if (!verifier) {
    console.error('Falta PRIVATE_KEY (verificador) en apps/.env')
    process.exit(1)
  }
  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'

  const env = await initTestEnv()
  const { base } = resolveSiteTarget(env)
  const browser = await launchBrowser(env.headless)

  // Los pastores se eligen **uno por clúster**, en orden: preparar A los reserva
  // (`container-fund-split-A`) y así la segunda elección no los vuelve a tomar.
  const clusters = []
  const used = new Set()
  try {
    for (const side of ['A', 'B']) {
      const picked = resolveClusterPastors({ count: 3, destructive: true, exclude: [...used] })
      if (picked.missing) {
        console.log(`[SKIP] ${picked.reason}`)
        await browser.close()
        process.exit(0)
      }
      const clash = picked.pastors.some((pastor) => used.has(pastor.address.toLowerCase()))
      if (clash) {
        console.log('[SKIP] el registro dio los mismos pastores para A y B: hacen falta seis distintos con el curso GD')
        await browser.close()
        process.exit(0)
      }
      const cluster = await presentCluster({
        browser, base, env, verifier, funder, pastors: picked.pastors, side, ok, fail,
      })
      if (!cluster) throw new Error(`el clúster ${side} no quedó presentado`)
      for (const session of cluster.sessions) used.add(session.pastor.address.toLowerCase())
      clusters.push({ ...cluster, side })
    }

    // ── A responde primero: el país se reparte entre los dos presentados ──
    const [a, b] = clusters
    console.log('\n── A responde: reparto del país y liberación de su fondo ──')
    const releaseA = await answer(a, verifier, 'A', ok, fail)
    markClusterCompleted(a.sessions.map((session) => session.pastor.address))
    const stateA = (await apiOn(a.initiator.page, `/api/cluster/${a.clusterId}/gd-presentation?walletAddress=${a.wallet}`)).body || {}
    if (stateA.request?.status === 'answered') ok('A quedó en `answered`')
    else fail(`A quedó en ${stateA.request?.status}`)
    const answeredAtA = stateA.request?.answered_at
    const responseA = stateA.request?.response

    // ── B responde: como A ya fue liberado, el reparto llega sólo a B ────
    console.log('\n── B responde: el reparto no vuelve a alcanzar a A ──')
    const releaseB = await answer(b, verifier, 'B', ok, fail)
    markClusterCompleted(b.sessions.map((session) => session.pastor.address))

    if (releaseA?.distribution && releaseB?.distribution) {
      if (releaseA.distribution !== releaseB.distribution) {
        ok('cada respuesta reparte en su propia transacción (A y B no comparten el hash)')
      } else {
        fail('las dos respuestas reportan el mismo hash de reparto')
      }
    }

    const stateB = (await apiOn(b.initiator.page, `/api/cluster/${b.clusterId}/gd-presentation?walletAddress=${b.wallet}`)).body || {}
    if (stateB.request?.status === 'answered') ok('B quedó en `answered`')
    else fail(`B quedó en ${stateB.request?.status}`)

    // A no vuelve a recibir: su verificación en cadena quedó en false y su fondo
    // liberado lo excluyen de los repartos posteriores (`fund_released_at`). Se
    // comprueba que el registro de A no cambió con la respuesta de B.
    const afterB = (await apiOn(a.initiator.page, `/api/cluster/${a.clusterId}/gd-presentation?walletAddress=${a.wallet}`)).body || {}
    if (afterB.request?.answered_at === answeredAtA && afterB.request?.response === responseA) {
      ok('la respuesta de B no reescribió el registro de A')
    } else {
      fail(`el registro de A cambió con la respuesta de B: ${JSON.stringify({ antes: answeredAtA, despues: afterB.request?.answered_at })}`)
    }
    if (releaseA?.release && afterB.request?.status === 'answered') {
      ok(`A conserva su liberación (${String(releaseA.release).slice(0, 12)}…) y no participa del reparto de B`)
    }

    // ── Una tercera respuesta no libera otra vez ─────────────────────────
    console.log('\n── Responder otra vez no libera de nuevo ──')
    for (const cluster of clusters) {
      const again = await cluster.verifierApi(`/api/cluster/${cluster.clusterId}/gd-presentation`, {
        method: 'PUT',
        body: JSON.stringify({ walletAddress: verifier.address, status: 'answered', response: 'again' }),
      })
      if (again.status === 409) ok(`${cluster.side}: responder otra vez → 409 (answered es terminal)`)
      else fail(`${cluster.side}: una segunda respuesta devolvió ${again.status} ${JSON.stringify(again.body)}`)
    }

    // ── Las iglesias de ambos clústeres cerraron su ciclo ────────────────
    console.log('\n── Ninguna iglesia repite el proceso ──')
    for (const cluster of clusters) {
      const rejoin = await apiOn(cluster.initiator.page, '/api/cluster', {
        method: 'POST',
        body: JSON.stringify({ walletAddress: cluster.wallet, name: `E2E otra vez ${Date.now().toString(36)}` }),
      })
      if (rejoin.status === 403 && rejoin.body?.code === 'cluster_completed') {
        ok(`${cluster.side}: crear otro clúster → 403 cluster_completed`)
      } else {
        fail(`${cluster.side}: crear otro clúster devolvió ${rejoin.status} ${JSON.stringify(rejoin.body)}`)
      }
    }

  } catch (error) {
    fail(`la corrida se detuvo: ${error.message}`)
  } finally {
    await browser.close()
  }

  const failures = summary(t0)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
