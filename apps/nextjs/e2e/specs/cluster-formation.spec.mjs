// E2E Test: Cluster formation (https://github.com/pasosdeJesus/learn.tg/issues/220) — admin CRUD + ranking pseudonym +
// auth gating + estado/candidatos del pastor. El flujo de invitaciones
// (aceptar/rechazar/activación a 3) está cubierto por unit tests del motor
// (cluster-invitation.test.ts); aquí se verifica el contrato HTTP y el
// pseudónimo en el ranking.
//
// Prerrequisitos: wallet de apps/.env registrada y verificadora en el dev site.
// Ejecución:
//   IPDES=learn.tg PUERTOPRU=9001 CHAIN_ID=11142220 \
//     CHROME_PATH=/usr/local/bin/chrome bin/m test:e2e cluster-formation

import * as fs from 'fs'
import * as path from 'path'
import {
  initTestEnv, launchBrowser,
  resetFailures, fail, ok, summary,
} from '@pasosdejesus/m/e2e'
import { resolveSiteTarget } from '../helpers/site-target.mjs'
import { setupE2EAuth } from '../helpers/e2e-auth.mjs'

const CHAIN_ID = parseInt(process.env.CHAIN_ID || '11142220', 10)

function loadEnvCredentials() {
  const envPaths = [
    path.join(process.cwd(), '..', '.env'),
    path.join(process.cwd(), 'apps', '.env'),
    path.join(process.cwd(), '.env'),
  ]
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8')
      const pk = content.match(/PRIVATE_KEY="([^"]+)"/)?.[1] || content.match(/PRIVATE_KEY=(\S+)/)?.[1]
      const addr = content.match(/NEXT_PUBLIC_ADDRESS="([^"]+)"/)?.[1] || content.match(/NEXT_PUBLIC_ADDRESS=(\S+)/)?.[1]
      if (pk && addr) return { pk, addr }
    }
  }
  return null
}

async function main() {
  const t0 = performance.now()
  resetFailures()

  const creds = loadEnvCredentials()
  if (!creds) { console.error('No credentials found'); process.exit(1) }
  process.env.TEST_PRIVATE_KEY = creds.pk

  const env = await initTestEnv()
  const { base } = resolveSiteTarget(env)
  console.log(`Wallet: ${creds.addr.slice(0, 10)}... | ${base} (chain: ${CHAIN_ID})`)

  const browser = await launchBrowser()
  const page = await browser.newPage()
  await setupE2EAuth(page, creds.addr, creds.pk, CHAIN_ID, base)
  const wallet = creds.addr.toLowerCase()
  // R-#233 Fase 2: la credencial es la cookie de sesión (ya no hay token de API).
  // Las llamadas autenticadas hechas desde Node deben enviarla explícitamente.
  const cookieHeader = (await page.browserContext().cookies())
    .map((c) => `${c.name}=${c.value}`).join('; ')
  const authFetch = (url, init = {}) =>
    fetch(url, { ...init, headers: { ...(init.headers || {}), Cookie: cookieHeader } })
  const q = `wallet=${encodeURIComponent(wallet)}`
  const qc = `walletAddress=${encodeURIComponent(wallet)}`
  const name = `E2E ${Date.now().toString(36)}`

  // ════════════════════════════════════════════════════════════════
  // 1. Auth gating (without a session)
  // ════════════════════════════════════════════════════════════════
  console.log('\n── 1. Auth gating ──')
  const unauth = await fetch(`${base}/api/cluster/status`)
  if (unauth.status === 401) ok('GET /api/cluster/status without a session → 401')
  else fail(`GET /api/cluster/status without a session → ${unauth.status}`)
  const unauthAdmin = await fetch(`${base}/api/admin/clusters`)
  if (unauthAdmin.status === 403) ok('GET /api/admin/clusters without a session → 403')
  else fail(`GET /api/admin/clusters without a session → ${unauthAdmin.status}`)

  // ════════════════════════════════════════════════════════════════
  // 2. Pastor status and candidates (verifier wallet)
  // ════════════════════════════════════════════════════════════════
  console.log('\n── 2. Pastor status and candidates ──')
  const statusRes = await authFetch(`${base}/api/cluster/status?${qc}`)
  if (statusRes.status === 200) {
    const s = await statusRes.json()
    ok(`GET /api/cluster/status → 200 (hasCluster=${s.hasCluster}, invitations=${s.pendingInvitations?.length ?? 0})`)
  } else fail(`GET /api/cluster/status → ${statusRes.status}`)
  const candRes = await authFetch(`${base}/api/cluster/candidates?${qc}`)
  if (candRes.status === 200) {
    const c = await candRes.json()
    ok(`GET /api/cluster/candidates → 200 (candidates=${c.candidates?.length ?? 0}, fallback=${c.fallback})`)
  } else if (candRes.status === 400) {
    ok('GET /api/cluster/candidates → 400 (pastor without a declared church, expected)')
  } else fail(`GET /api/cluster/candidates → ${candRes.status}`)

  // ════════════════════════════════════════════════════════════════
  // 3. Admin: cluster list
  // ════════════════════════════════════════════════════════════════
  console.log('\n── 3. Admin: list ──')
  const listRes = await authFetch(`${base}/api/admin/clusters?${q}`)
  if (listRes.status === 200) {
    const list = await listRes.json()
    ok(`GET /api/admin/clusters → 200 (${list.clusters?.length ?? 0} clusters)`)
  } else fail(`GET /api/admin/clusters → ${listRes.status}`)

  // ════════════════════════════════════════════════════════════════
  // 4. Admin: crear clúster con una iglesia existente como líder
  // ════════════════════════════════════════════════════════════════
  console.log('\n── 4. Admin: crear clúster ──')
  const churchesRes = await authFetch(`${base}/api/admin/churches?${q}`)
  let leaderChurch = null
  if (churchesRes.ok) {
    const churches = (await churchesRes.json()).churches || (await churchesRes.json()) || []
    const arr = Array.isArray(churches) ? churches : (churches.rows || [])
    leaderChurch = arr.find((c) => c.registration_verified === true) || arr[0] || null
  }
  if (!leaderChurch) { console.log('  [skip] no churches on the dev site — skipping cluster creation'); ok('SKIP: no churches to create a cluster') }
  else {
    const createRes = await authFetch(`${base}/api/admin/clusters?${q}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, pseudonym: 'PseudonimoE2E', leaderChurchId: leaderChurch.id,
        countryId: leaderChurch.country_id, memberChurchIds: [],
      }),
    })
    const created = await createRes.json().catch(() => ({}))
    if (createRes.status === 201 && created.cluster?.id) {
      ok(`POST /api/admin/clusters → 201 (id=${created.cluster.id}, status=${created.cluster.status})`)
      const clusterId = created.cluster.id

      // 5. Detalle
      const detailRes = await authFetch(`${base}/api/admin/clusters/${clusterId}?${q}`)
      const detail = await detailRes.json().catch(() => ({}))
      if (detailRes.status === 200 && detail.cluster?.name === name) ok(`GET /api/admin/clusters/[id] → 200 (${detail.cluster.name})`)
      else fail(`GET /api/admin/clusters/[id] → ${detailRes.status}`)

      // 6. Actualizar pseudónimo
      const upRes = await authFetch(`${base}/api/admin/clusters/${clusterId}?${q}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudonym: 'PseudoActualizado' }),
      })
      if (upRes.status === 200) ok('PUT /api/admin/clusters/[id] (pseudonym) → 200')
      else fail(`PUT /api/admin/clusters/[id] → ${upRes.status}`)

      // 7. Ranking con pseudónimo
      const rankRes = await fetch(`${base}/api/gdcluster/ranking/clusters`)
      const rank = await rankRes.json().catch(() => ({ clusters: [] }))
      const row = (rank.clusters || []).find((c) => c.id === clusterId)
      if (row && row.display_name === 'PseudoActualizado') ok(`Ranking shows the pseudonym (display_name=${row.display_name})`)
      else { console.log(`  ranking row: ${JSON.stringify(row)}`); fail('Ranking without the updated pseudonym') }

      // 8. Disolver (soft) → ranking lo excluye
      const delRes = await authFetch(`${base}/api/admin/clusters/${clusterId}?${q}`, { method: 'DELETE' })
      if (delRes.status === 200) ok('DELETE /api/admin/clusters/[id] (disband) → 200')
      else fail(`DELETE /api/admin/clusters/[id] → ${delRes.status}`)
      const rank2 = await (await fetch(`${base}/api/gdcluster/ranking/clusters`)).json().catch(() => ({ clusters: [] }))
      const still = (rank2.clusters || []).some((c) => c.id === clusterId)
      if (!still) ok('Ranking excludes the disbanded cluster')
      else fail('The disbanded cluster is still in the ranking')
    } else {
      console.log(`  create: ${createRes.status} ${JSON.stringify(created).slice(0, 120)}`)
      fail('POST /api/admin/clusters did not return 201')
    }
  }

  // ════════════════════════════════════════════════════════════════
  // 9. Invitation: accept a nonexistent id → 404 (auth validation)
  // ════════════════════════════════════════════════════════════════
  console.log('\n── 9. Invitation: accept nonexistent ──')
  const accRes = await authFetch(`${base}/api/cluster/invitation/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress: wallet, invitationId: 999999 }),
  })
  if (accRes.status === 404) ok('POST /api/cluster/invitation/accept (inexistente) → 404')
  else { console.log(`  accept: ${accRes.status} ${(await accRes.text()).slice(0, 80)}`); fail(`accept → ${accRes.status}`) }

  await browser.close()
  const failures = summary(t0); process.exit(failures > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
