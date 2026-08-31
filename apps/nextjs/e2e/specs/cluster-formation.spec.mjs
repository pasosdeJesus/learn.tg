// E2E Test: Cluster formation (REQ/220) — admin CRUD + ranking pseudonym +
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
  const { base } = env
  console.log(`Wallet: ${creds.addr.slice(0, 10)}... | ${base} (chain: ${CHAIN_ID})`)

  const browser = await launchBrowser()
  const page = await browser.newPage()
  const { authToken } = await setupE2EAuth(page, creds.addr, creds.pk, CHAIN_ID, base)
  const wallet = creds.addr.toLowerCase()
  const q = `wallet=${encodeURIComponent(wallet)}&token=${encodeURIComponent(authToken)}`
  const qc = `walletAddress=${encodeURIComponent(wallet)}&token=${encodeURIComponent(authToken)}`
  const name = `E2E ${Date.now().toString(36)}`

  // ════════════════════════════════════════════════════════════════
  // 1. Auth gating (sin token)
  // ════════════════════════════════════════════════════════════════
  console.log('\n── 1. Auth gating ──')
  const unauth = await fetch(`${base}/api/cluster/status`)
  if (unauth.status === 401) ok('GET /api/cluster/status sin token → 401')
  else fail(`GET /api/cluster/status sin token → ${unauth.status}`)
  const unauthAdmin = await fetch(`${base}/api/admin/clusters`)
  if (unauthAdmin.status === 403) ok('GET /api/admin/clusters sin token → 403')
  else fail(`GET /api/admin/clusters sin token → ${unauthAdmin.status}`)

  // ════════════════════════════════════════════════════════════════
  // 2. Estado y candidatos del pastor (wallet verificadora)
  // ════════════════════════════════════════════════════════════════
  console.log('\n── 2. Estado y candidatos del pastor ──')
  const statusRes = await fetch(`${base}/api/cluster/status?${qc}`)
  if (statusRes.status === 200) {
    const s = await statusRes.json()
    ok(`GET /api/cluster/status → 200 (hasCluster=${s.hasCluster}, invitaciones=${s.pendingInvitations?.length ?? 0})`)
  } else fail(`GET /api/cluster/status → ${statusRes.status}`)
  const candRes = await fetch(`${base}/api/cluster/candidates?${qc}`)
  if (candRes.status === 200) {
    const c = await candRes.json()
    ok(`GET /api/cluster/candidates → 200 (candidatos=${c.candidates?.length ?? 0}, fallback=${c.fallback})`)
  } else if (candRes.status === 400) {
    ok('GET /api/cluster/candidates → 400 (pastor sin iglesia declarada, esperado)')
  } else fail(`GET /api/cluster/candidates → ${candRes.status}`)

  // ════════════════════════════════════════════════════════════════
  // 3. Admin: lista de clústeres
  // ════════════════════════════════════════════════════════════════
  console.log('\n── 3. Admin: lista ──')
  const listRes = await fetch(`${base}/api/admin/clusters?${q}`)
  if (listRes.status === 200) {
    const list = await listRes.json()
    ok(`GET /api/admin/clusters → 200 (${list.clusters?.length ?? 0} clústeres)`)
  } else fail(`GET /api/admin/clusters → ${listRes.status}`)

  // ════════════════════════════════════════════════════════════════
  // 4. Admin: crear clúster con una iglesia existente como líder
  // ════════════════════════════════════════════════════════════════
  console.log('\n── 4. Admin: crear clúster ──')
  const churchesRes = await fetch(`${base}/api/admin/churches?${q}`)
  let leaderChurch = null
  if (churchesRes.ok) {
    const churches = (await churchesRes.json()).churches || (await churchesRes.json()) || []
    const arr = Array.isArray(churches) ? churches : (churches.rows || [])
    leaderChurch = arr.find((c) => c.registration_verified === true) || arr[0] || null
  }
  if (!leaderChurch) { console.log('  [skip] sin iglesias en el dev site — se omite crear clúster'); ok('SKIP: no hay iglesias para crear clúster') }
  else {
    const createRes = await fetch(`${base}/api/admin/clusters?${q}`, {
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
      const detailRes = await fetch(`${base}/api/admin/clusters/${clusterId}?${q}`)
      const detail = await detailRes.json().catch(() => ({}))
      if (detailRes.status === 200 && detail.cluster?.name === name) ok(`GET /api/admin/clusters/[id] → 200 (${detail.cluster.name})`)
      else fail(`GET /api/admin/clusters/[id] → ${detailRes.status}`)

      // 6. Actualizar pseudónimo
      const upRes = await fetch(`${base}/api/admin/clusters/${clusterId}?${q}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudonym: 'PseudoActualizado' }),
      })
      if (upRes.status === 200) ok('PUT /api/admin/clusters/[id] (pseudónimo) → 200')
      else fail(`PUT /api/admin/clusters/[id] → ${upRes.status}`)

      // 7. Ranking con pseudónimo
      const rankRes = await fetch(`${base}/api/gdcluster/ranking/clusters`)
      const rank = await rankRes.json().catch(() => ({ clusters: [] }))
      const row = (rank.clusters || []).find((c) => c.id === clusterId)
      if (row && row.display_name === 'PseudoActualizado') ok(`Ranking muestra el pseudónimo (display_name=${row.display_name})`)
      else { console.log(`  ranking row: ${JSON.stringify(row)}`); fail('Ranking sin pseudónimo actualizado') }

      // 8. Disolver (soft) → ranking lo excluye
      const delRes = await fetch(`${base}/api/admin/clusters/${clusterId}?${q}`, { method: 'DELETE' })
      if (delRes.status === 200) ok('DELETE /api/admin/clusters/[id] (disband) → 200')
      else fail(`DELETE /api/admin/clusters/[id] → ${delRes.status}`)
      const rank2 = await (await fetch(`${base}/api/gdcluster/ranking/clusters`)).json().catch(() => ({ clusters: [] }))
      const still = (rank2.clusters || []).some((c) => c.id === clusterId)
      if (!still) ok('Ranking excluye el clúster disuelto')
      else fail('El clúster disuelto sigue en el ranking')
    } else {
      console.log(`  create: ${createRes.status} ${JSON.stringify(created).slice(0, 120)}`)
      fail('POST /api/admin/clusters no devolvió 201')
    }
  }

  // ════════════════════════════════════════════════════════════════
  // 9. Invitación: accept con id inexistente → 404 (validación auth)
  // ════════════════════════════════════════════════════════════════
  console.log('\n── 9. Invitación: aceptar inexistente ──')
  const accRes = await fetch(`${base}/api/cluster/invitation/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress: wallet, token: authToken, invitationId: 999999 }),
  })
  if (accRes.status === 404) ok('POST /api/cluster/invitation/accept (inexistente) → 404')
  else { console.log(`  accept: ${accRes.status} ${(await accRes.text()).slice(0, 80)}`); fail(`accept → ${accRes.status}`) }

  await browser.close()
  const failures = summary(t0); process.exit(failures > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
