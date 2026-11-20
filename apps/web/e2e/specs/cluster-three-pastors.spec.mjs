#!/usr/bin/env node
// E2E: tres pastores existentes forman un clúster y aprueban la billetera
// (https://github.com/pasosdeJesus/learn.tg/issues/161, REQ/161 §4.7).
//
// Toma tres pastores del registro local (`apps/.e2e-wallets.local.json`, vía
// `resolveClusterPastors`, que crea billeteras nuevas cuando faltan puestos) y forma el
// clúster con el flujo actual: el iniciador lo crea, invita a los otros dos **por
// billetera** y cada uno acepta. Después se aprueba la **fase `wallet`**: el iniciador
// primero (su aprobación fija la billetera), luego los otros dos, y con la tercera el
// estado pasa a `wallet_approved` y el fondo del clúster empieza a existir.
//
// Se omiten la fase `data` (necesita presupuesto y oferta del director con PDF) y
// `sent`/`answered` (contrato y firma del operador): los cubren `cluster-ready`,
// `cluster-wallet-approval` y `cluster-flow`.
//
// Ejecución:
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 \
//   CHAIN_ID=11142220 node e2e/specs/cluster-three-pastors.spec.mjs

import { fail, initTestEnv, launchBrowser, newIncognitoContext, newIncognitoPage, ok, resetFailures, resolveSiteTarget, summary } from '@pasosdejesus/m/e2e'
import { setupE2EAuth } from '../helpers/e2e-auth.mjs'
import { loadVerifierWallet } from '../helpers/e2e-wallet.mjs'
import { resolveClusterPastors } from '../helpers/e2e-pastors.mjs'
import { apiOn, ensurePastorFixture } from '../helpers/e2e-fixture.mjs'
import { markWalletUsed } from '../helpers/e2e-wallets-registry.mjs'

function skip(message) {
  console.log(`  [NOTE] ${message}`)
}

async function main() {
  const t0 = performance.now()
  resetFailures()

  // El iniciador necesita el curso GD; los otros dos puestos se crean si faltan.
  const picked = await resolveClusterPastors({ count: 3 })
  if (picked.missing) {
    console.log(`[SKIP] ${picked.reason}`)
    process.exit(0)
  }
  const pastors = picked.pastors
  const verifier = loadVerifierWallet()
  if (pastors.some((pastor) => !pastor) || !verifier) {
    console.error('Faltan pastores en el registro o PRIVATE_KEY en apps/.env')
    process.exit(1)
  }

  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'

  const env = await initTestEnv()
  const { timeout } = env
  const { base } = resolveSiteTarget(env)
  console.log(`Pastores: ${pastors.map((p) => p.address.slice(0, 8)).join(', ')} | ${base}`)

  const browser = await launchBrowser(env.headless)
  const verifierContext = await newIncognitoContext(browser)
  const verifierPage = await newIncognitoPage(verifierContext, verifier.address, timeout)
  await setupE2EAuth(verifierPage, verifier.address, verifier.pk, process.env.CHAIN_ID, base)
  const admin = (path, init) =>
    apiOn(verifierPage, `${path}${path.includes('?') ? '&' : '?'}wallet=${verifier.address}`, init)

  // ── 1. Sesiones y siembra ───────────────────────────────────────────
  console.log('\n── 1. Pastores listos ──')
  const sessions = []
  for (const pastor of pastors) {
    const context = await newIncognitoContext(browser)
    const page = await newIncognitoPage(context, pastor.address, timeout)
    await page.setDefaultNavigationTimeout(180000)
    await setupE2EAuth(page, pastor.address, pastor.pk, process.env.CHAIN_ID, base)
    const api = (path, init) => apiOn(page, path, init)
    const fixture = await ensurePastorFixture({
      verifierPage, verifierAddress: verifier.address, pastorPage: page, pastor,
    })
    // Invitar exige una iglesia verificada: la verificadora la confirma aquí.
    const verified = await admin(`/api/admin/church/${fixture.churchId}`, {
      method: 'PATCH',
      body: JSON.stringify({ registration_verified: true }),
    })
    if (verified.status === 200) ok(`${pastor.address.slice(0, 8)}: iglesia #${fixture.churchId} verificada`)
    else fail(`${pastor.address.slice(0, 8)}: no se pudo verificar la iglesia (${verified.status})`)
    sessions.push({ pastor, page, api, churchId: fixture.churchId })
  }
  const [initiator, second, third] = sessions

  // ── 2. El iniciador crea el clúster ─────────────────────────────────
  console.log('\n── 2. Crear el clúster ──')
  // Una corrida anterior pudo dejar su clúster abierto: la iglesia sólo puede estar en
  // un clúster, así que se disuelven los que dejaron los specs (nombres `E2E …`).
  const leftovers = await admin('/api/admin/clusters')
  const all = leftovers.body?.clusters || []
  console.log(`  [info] admin/clusters → ${leftovers.status}, ${all.length} clúster(es)`)
  for (const row of all.filter((entry) => /^E2E /.test(String(entry.name || '')))) {
    const cleaned = await admin(`/api/admin/clusters/${row.id}`, { method: 'DELETE' })
    if ([200, 204].includes(cleaned.status)) ok(`clúster previo #${row.id} (${row.name}) disuelto`)
    else fail(`no se pudo disolver el clúster previo #${row.id} (${cleaned.status})`)
  }

  const name = `E2E Tres ${Date.now().toString(36)}`
  const created = await initiator.api('/api/cluster', {
    method: 'POST',
    body: JSON.stringify({ walletAddress: initiator.pastor.address, name }),
  })
  const clusterId = created.body?.cluster?.id ?? created.body?.id
  if ([200, 201].includes(created.status) && clusterId) ok(`clúster creado (#${clusterId}, ${name})`)
  else {
    fail(`no se pudo crear el clúster (${created.status} ${JSON.stringify(created.body).slice(0, 160)})`)
    summary(t0)
    await browser.close()
    process.exit(1)
  }

  // ── 3. Invitación por billetera y aceptación ────────────────────────
  console.log('\n── 3. Invitaciones por billetera ──')
  for (const session of [second, third]) {
    const invited = await initiator.api('/api/cluster/invitation/wallet', {
      method: 'POST',
      body: JSON.stringify({ walletAddress: initiator.pastor.address, invitedWallet: session.pastor.address }),
    })
    if (invited.status === 200) ok(`${session.pastor.address.slice(0, 8)}: invitación enviada`)
    else {
      fail(`${session.pastor.address.slice(0, 8)}: invitación rechazada (${invited.status} ${JSON.stringify(invited.body).slice(0, 120)})`)
      continue
    }
    const list = await session.api(`/api/cluster/invitations?walletAddress=${session.pastor.address}`)
    const invitationId = (list.body?.invitations || [])[0]?.id
    if (!invitationId) {
      fail(`${session.pastor.address.slice(0, 8)}: no aparece la invitación`)
      continue
    }
    const accepted = await session.api('/api/cluster/invitation/accept', {
      method: 'POST',
      body: JSON.stringify({ walletAddress: session.pastor.address, invitationId }),
    })
    if (accepted.status === 200) ok(`${session.pastor.address.slice(0, 8)}: aceptó`)
    else fail(`${session.pastor.address.slice(0, 8)}: no pudo aceptar (${accepted.status} ${JSON.stringify(accepted.body).slice(0, 120)})`)
  }
  const cluster = await initiator.api(`/api/cluster/${clusterId}?walletAddress=${initiator.pastor.address}`)
  if (cluster.body?.members?.length === 3) ok('el clúster tiene 3 iglesias')
  else fail(`iglesias del clúster: ${cluster.body?.members?.length}`)
  if (cluster.body?.status === 'active') ok('el clúster quedó activo')
  else fail(`estado del clúster: ${cluster.body?.status}`)
  if (cluster.body?.gd_status === 'forming') ok('estado de la presentación: forming')
  else fail(`gd_status inesperado: ${cluster.body?.gd_status}`)

  // ── 4. Billetera y fase `wallet` ────────────────────────────────────
  console.log('\n── 4. Aprobación de la billetera ──')
  // La iglesia iniciadora puede traer la billetera de un ciclo anterior **con saldo** en
  // ClusterFundsV2 (las billeteras del registro se reutilizan): la API contesta
  // 409 `cluster_wallet_has_funds` y pide `confirmMigrate` para cambiarla, porque el saldo
  // viejo no se mueve (R-#220 §4). Se confirma y se sigue.
  const setWallet = (extra = {}) => initiator.api(`/api/cluster/${clusterId}`, {
    method: 'PATCH',
    body: JSON.stringify({ walletAddress: initiator.pastor.address, clusterWallet: initiator.pastor.address, ...extra }),
  })
  let saved = await setWallet()
  if (saved.status === 409 && saved.body?.code === 'cluster_wallet_has_funds') {
    ok('la billetera anterior tenía fondos: se confirma el cambio (409 cluster_wallet_has_funds)')
    saved = await setWallet({ confirmMigrate: true })
  }
  if (saved.status === 200) ok('el iniciador fijó la billetera del clúster')
  else fail(`no se pudo fijar la billetera (${saved.status} ${JSON.stringify(saved.body).slice(0, 120)})`)

  const approve = (session) => session.api(`/api/cluster/${clusterId}/approval?phase=wallet`, {
    method: 'POST',
    body: JSON.stringify({ walletAddress: session.pastor.address, phase: 'wallet' }),
  })

  // Regla del iniciador: otro pastor no puede aprobar antes que él.
  const early = await approve(second)
  if (early.status === 409 && early.body?.code === 'initiator_must_approve_first') {
    ok('otro pastor no puede aprobar antes del iniciador (409 initiator_must_approve_first)')
  } else {
    fail(`aprobación fuera de orden: ${early.status} ${JSON.stringify(early.body).slice(0, 140)}`)
  }

  const first = await approve(initiator)
  if (first.status === 200) ok('el iniciador aprobó la billetera')
  else fail(`el iniciador no pudo aprobar (${first.status} ${JSON.stringify(first.body).slice(0, 140)})`)

  // Desde la aprobación del iniciador la billetera queda fija.
  const frozen = await initiator.api(`/api/cluster/${clusterId}`, {
    method: 'PATCH',
    body: JSON.stringify({ walletAddress: initiator.pastor.address, clusterWallet: '0x1111111111111111111111111111111111111111' }),
  })
  if (frozen.status === 409 && frozen.body?.code === 'gd_fields_locked') {
    ok('la billetera ya no se puede cambiar (409 gd_fields_locked)')
  } else {
    fail(`la billetera cambió después de la aprobación del iniciador (${frozen.status})`)
  }

  for (const session of [second, third]) {
    const res = await approve(session)
    if (res.status === 200) ok(`${session.pastor.address.slice(0, 8)}: aprobó la billetera`)
    else fail(`${session.pastor.address.slice(0, 8)}: no pudo aprobar (${res.status} ${JSON.stringify(res.body).slice(0, 140)})`)
  }

  const after = await initiator.api(`/api/cluster/${clusterId}?walletAddress=${initiator.pastor.address}`)
  if (after.body?.gd_status === 'wallet_approved') ok('con la tercera aprobación el estado es wallet_approved')
  else fail(`gd_status tras las tres aprobaciones: ${after.body?.gd_status}`)
  const approvals = await initiator.api(`/api/cluster/${clusterId}/approval?walletAddress=${initiator.pastor.address}&phase=wallet`)
  if (approvals.body?.approved === 3 && approvals.body?.pastors === 3) ok('aprobaciones de la billetera 3/3')
  else fail(`aprobaciones inesperadas: ${JSON.stringify(approvals.body).slice(0, 160)}`)

  // El fondo del clúster existe desde wallet_approved: la página pública lo publica.
  const publicCluster = await initiator.api(`/api/clusters/${after.body?.slug}`)
  if (publicCluster.body?.donation_wallet) {
    ok('la página pública ya publica la billetera para donar')
  } else {
    skip(`donation_wallet todavía nulo (país no tipo 1): ${JSON.stringify(publicCluster.body?.donation_wallet)}`)
  }

  // La membresía queda congelada desde la aprobación de la billetera.
  const leave = await second.api(`/api/cluster/${clusterId}/leave`, {
    method: 'POST',
    body: JSON.stringify({ walletAddress: second.pastor.address }),
  })
  if (leave.status === 409 && leave.body?.code === 'cluster_membership_locked') {
    ok('la membresía está congelada (409 cluster_membership_locked)')
  } else {
    fail(`salir con la billetera aprobada: ${leave.status} ${JSON.stringify(leave.body).slice(0, 120)}`)
  }

  // La aprobación de datos todavía no está abierta (falta el presupuesto y la oferta).
  const earlyData = await second.api(`/api/cluster/${clusterId}/approval?phase=data`, {
    method: 'POST',
    body: JSON.stringify({ walletAddress: second.pastor.address, phase: 'data' }),
  })
  if (earlyData.status === 409 && earlyData.body?.code === 'data_approval_not_open') {
    ok('la aprobación de datos no está abierta todavía (409 data_approval_not_open)')
  } else {
    fail(`aprobación de datos antes de tiempo: ${earlyData.status} ${JSON.stringify(earlyData.body).slice(0, 120)}`)
  }

  // ── 5. Fuera de alcance ─────────────────────────────────────────────
  console.log('\n── 5. Fuera de alcance ──')
  skip('la fase `data` (presupuesto y oferta del director con PDF) la cubren cluster-wallet-approval/cluster-ready')
  skip('`sent`/`answered` y la liberación del fondo: contrato y firma del operador')

  // ── 6. Limpieza: la verificadora disuelve el clúster ────────────────
  console.log('\n── 6. Limpieza ──')
  const disbanded = await admin(`/api/admin/clusters/${clusterId}`, { method: 'DELETE' })
  if ([200, 204].includes(disbanded.status)) ok(`clúster #${clusterId} disuelto`)
  else fail(`no se pudo disolver el clúster (${disbanded.status})`)
  for (const session of sessions) {
    markWalletUsed(session.pastor.address, { note: 'cluster-three-pastors (wallet phase)' })
  }

  await browser.close()
  const seconds = ((performance.now() - t0) / 1000).toFixed(1)
  console.log(`\nDuración: ${seconds}s`)
  const failures = summary(t0)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
