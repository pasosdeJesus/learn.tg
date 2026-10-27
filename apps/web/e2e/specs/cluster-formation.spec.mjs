// E2E Test: Cluster formation (https://github.com/pasosdeJesus/learn.tg/issues/220).
// Covers the HTTP contract and the two UI surfaces the requirement asks for:
//   - /[lang]/admin/clusters (table, search, filters, edit, disband)
//   - /[lang]/gdcluster/ranking (status column)
// The 3-pastor invitation flow (create → invite → accept → active at 3 → leave)
// needs three pastor fixtures with a verified church and the GD course paid; the
// engine unit tests (cluster-invitation.test.ts) remain the reference for it.
//
// Prerequisites: wallet from apps/.env registered and verifier on the dev site.
// Execution:
//   make test-e2e-spec SPEC=cluster-formation
// or
//   IPDES=learn.tg PUERTOPRU=9001 CHAIN_ID=11142220 \
//     CHROME_PATH=/usr/local/bin/chrome bin/m test:e2e cluster-formation

import * as fs from 'fs'
import * as path from 'path'
import { initTestEnv, launchBrowser, ok, fail, summary, resetFailures, resolveSiteTarget } from '@pasosdejesus/m/e2e'
import { setupE2EAuth } from '../helpers/e2e-auth.mjs'

// This spec WRITES (it creates, edits and disbands clusters), so it must never
// default to production: without an explicit target it points to the dev site,
// like the `make` shortcuts (doc/e2e-testing.md §1.2).
if (!process.env.IPDES && !process.env.SITE_URL) {
  process.env.IPDES = 'learn.tg'
  process.env.PUERTOPRU = '9001'
  process.env.CHAIN_ID = '11142220'
}

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

async function navAndWait(page, url, timeout) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout })
      break
    } catch (e) {
      if (attempt === 2) throw e
      await new Promise(r => setTimeout(r, 3000))
    }
  }
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 2000))
    const bodyLen = await page.evaluate(() =>
      document.body?.textContent?.replace(/\s+/g, '').length || 0).catch(() => 0)
    if (bodyLen > 100) return true
  }
  return false
}

async function main() {
  const t0 = performance.now()
  resetFailures()

  const creds = loadEnvCredentials()
  if (!creds) { console.error('No credentials found'); process.exit(1) }
  process.env.TEST_PRIVATE_KEY = creds.pk

  const env = await initTestEnv()
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'
  const { base } = resolveSiteTarget(env)
  console.log(`Wallet: ${creds.addr.slice(0, 10)}... | ${base} (chain: ${process.env.CHAIN_ID})`)

  const browser = await launchBrowser()
  const page = await browser.newPage()
  await page.setDefaultNavigationTimeout(180000)
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
  const es = process.env.E2E_LANG === 'es'
  const lang = es ? 'es' : 'en'

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
  // 3. Admin: list + search + status filter
  // ════════════════════════════════════════════════════════════════
  console.log('\n── 3. Admin: list and filters ──')
  const listRes = await authFetch(`${base}/api/admin/clusters?${q}`)
  if (listRes.status === 200) {
    const list = await listRes.json()
    ok(`GET /api/admin/clusters → 200 (${list.clusters?.length ?? 0} clusters)`)
  } else fail(`GET /api/admin/clusters → ${listRes.status}`)

  const activeRes = await authFetch(`${base}/api/admin/clusters?status=active&${q}`)
  if (activeRes.status === 200) {
    const list = await activeRes.json()
    const wrong = (list.clusters || []).filter((c) => c.status !== 'active')
    if (wrong.length === 0) ok(`status=active filter → 200 (${list.clusters?.length ?? 0} rows, all active)`)
    else fail(`status=active filter returned ${wrong.length} non-active rows`)
  } else fail(`GET /api/admin/clusters?status=active → ${activeRes.status}`)

  const searchRes = await authFetch(`${base}/api/admin/clusters?q=${encodeURIComponent(name)}&${q}`)
  if (searchRes.status === 200) {
    const list = await searchRes.json()
    ok(`q=${name} filter → 200 (${list.clusters?.length ?? 0} rows)`)
  } else fail(`GET /api/admin/clusters?q=… → ${searchRes.status}`)

  // ════════════════════════════════════════════════════════════════
  // 4. Admin: create a cluster (leader church)
  // ════════════════════════════════════════════════════════════════
  console.log('\n── 4. Admin: create cluster ──')
  const churchesRes = await authFetch(`${base}/api/admin/churches?${q}`)
  let churches = []
  if (churchesRes.ok) {
    const data = await churchesRes.json().catch(() => ({}))
    churches = Array.isArray(data) ? data : (data.churches || data.rows || [])
  }
  const leaderChurch = churches.find((c) => c.registration_verified === true) || churches[0] || null

  let clusterId = null
  if (!leaderChurch) {
    console.log('  [SKIP] no churches on the dev site — cluster creation skipped')
  } else {
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
      clusterId = created.cluster.id
      ok(`POST /api/admin/clusters → 201 (id=${clusterId}, status=${created.cluster.status})`)
      if (created.cluster.status === 'pending') ok('The new cluster starts as pending')
      else fail(`The new cluster starts as ${created.cluster.status}, expected pending`)
    } else {
      console.log(`  create: ${createRes.status} ${JSON.stringify(created).slice(0, 120)}`)
      fail('POST /api/admin/clusters did not return 201')
    }
  }

  if (clusterId) {
    // ══════════════════════════════════════════════════════════════
    // 5. Admin: detail
    // ══════════════════════════════════════════════════════════════
    console.log('\n── 5. Admin: detail ──')
    const detailRes = await authFetch(`${base}/api/admin/clusters/${clusterId}?${q}`)
    const detail = await detailRes.json().catch(() => ({}))
    if (detailRes.status === 200 && detail.cluster?.name === name) ok(`GET /api/admin/clusters/[id] → 200 (${detail.cluster.name})`)
    else fail(`GET /api/admin/clusters/[id] → ${detailRes.status}`)

    // ══════════════════════════════════════════════════════════════
    // 6. Admin: add and remove a member church
    // ══════════════════════════════════════════════════════════════
    console.log('\n── 6. Admin: member add/remove ──')
    const otherChurch = churches.find((c) => c.id !== leaderChurch.id) || null
    if (!otherChurch) {
      console.log('  [SKIP] only one church on the dev site — member add/remove skipped')
    } else {
      const addRes = await authFetch(`${base}/api/admin/clusters/${clusterId}/members?${q}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ churchId: otherChurch.id }),
      })
      if (addRes.status === 200) {
        ok(`POST /api/admin/clusters/[id]/members → 200 (church ${otherChurch.id})`)
        const after = await (await authFetch(`${base}/api/admin/clusters/${clusterId}?${q}`)).json().catch(() => ({}))
        const members = after.cluster?.members || []
        if (members.some((m) => Number(m.church_id ?? m.id) === Number(otherChurch.id))) {
          ok('The member church appears in the cluster detail')
        } else fail('The added church is not in the cluster detail')
        const rmRes = await authFetch(`${base}/api/admin/clusters/${clusterId}/members?churchId=${otherChurch.id}&${q}`, { method: 'DELETE' })
        if (rmRes.status === 200) ok('DELETE /api/admin/clusters/[id]/members → 200')
        else fail(`DELETE /api/admin/clusters/[id]/members → ${rmRes.status}`)
      } else if (addRes.status === 409) {
        ok('SKIP: POST members → 409 (the church already belongs to a cluster)')
      } else {
        fail(`POST /api/admin/clusters/[id]/members → ${addRes.status}`)
      }
    }

    // ══════════════════════════════════════════════════════════════
    // 7. Admin: update pseudonym and status → ranking reflects both
    // ══════════════════════════════════════════════════════════════
    console.log('\n── 7. Admin: update pseudonym and status ──')
    const upRes = await authFetch(`${base}/api/admin/clusters/${clusterId}?${q}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pseudonym: 'PseudoActualizado', status: 'active' }),
    })
    if (upRes.status === 200) ok('PUT /api/admin/clusters/[id] (pseudonym + status) → 200')
    else fail(`PUT /api/admin/clusters/[id] → ${upRes.status}`)

    // ══════════════════════════════════════════════════════════════
    // 8. Ranking (public API): pseudonym and status of the cluster
    // ══════════════════════════════════════════════════════════════
    console.log('\n── 8. Ranking: pseudonym and status ──')
    const rank = await (await fetch(`${base}/api/gdcluster/ranking/clusters`)).json().catch(() => ({ clusters: [] }))
    const row = (rank.clusters || []).find((c) => c.id === clusterId)
    if (row && row.display_name === 'PseudoActualizado') ok(`Ranking shows the pseudonym (display_name=${row.display_name})`)
    else { console.log(`  ranking row: ${JSON.stringify(row)}`); fail('Ranking without the updated pseudonym') }
    if (row && 'status' in row) {
      ok(`The ranking row exposes the status (${row.status})`)
      if (row.status === 'active') ok('The ranking reports the cluster as active after the update')
      else fail(`The ranking reports status=${row.status}, expected active`)
    } else {
      fail('GET /api/gdcluster/ranking/clusters does not expose the cluster status')
    }

    // ══════════════════════════════════════════════════════════════
    // 9. Admin: disband (soft) → listed as disbanded, excluded from the ranking
    // ══════════════════════════════════════════════════════════════
    console.log('\n── 9. Admin: disband ──')
    const dbRes = await authFetch(`${base}/api/admin/clusters/${clusterId}?${q}`, { method: 'DELETE' })
    if (dbRes.status === 200) ok('DELETE /api/admin/clusters/[id] (disband) → 200')
    else fail(`DELETE /api/admin/clusters/[id] → ${dbRes.status}`)
    const disbanded = await (await authFetch(`${base}/api/admin/clusters?status=disbanded&${q}`)).json().catch(() => ({ clusters: [] }))
    if ((disbanded.clusters || []).some((c) => c.id === clusterId)) ok('The disbanded cluster is listed under status=disbanded')
    else fail('The disbanded cluster is not listed under status=disbanded')
    const rank2 = await (await fetch(`${base}/api/gdcluster/ranking/clusters`)).json().catch(() => ({ clusters: [] }))
    if (!(rank2.clusters || []).some((c) => c.id === clusterId)) ok('The ranking excludes the disbanded cluster')
    else fail('The disbanded cluster is still in the ranking')
  }

  // ════════════════════════════════════════════════════════════════
  // 10. UI: /[lang]/admin/clusters lists, searches and filters
  // ════════════════════════════════════════════════════════════════
  console.log('\n── 10. UI: admin clusters page ──')
  await navAndWait(page, `${base}/${lang}/admin/clusters`, 180000)
  await new Promise(r => setTimeout(r, 3000))
  const adminBody = await page.evaluate(() => document.body.textContent || '')
  const hasTitle = /All Clusters|Todos los Clústeres/.test(adminBody)
  const hasDenied = /Access denied|Acceso denegado/.test(adminBody)
  if (hasDenied) {
    fail('The verifier wallet is not recognized on /[lang]/admin/clusters (access denied)')
  } else if (!hasTitle) {
    fail('The admin clusters page did not render its title (is the build deployed?)')
  } else {
    ok('Admin clusters page renders for the verifier')
    const ui = await page.evaluate(() => {
      const search = document.querySelector('input[type="text"]')
      const selects = Array.from(document.querySelectorAll('select'))
      return {
        search: !!search,
        selects: selects.length,
        rows: document.querySelectorAll('table tbody tr').length,
        headers: Array.from(document.querySelectorAll('table thead th')).map((th) => (th.textContent || '').trim()),
        hasTable: !!document.querySelector('table'),
      }
    })
    if (ui.search) ok('The page has the search box')
    else fail('The page has no search box')
    if (ui.selects >= 2) ok(`The page has the ${ui.selects} filters (status and country)`)
    else fail(`The page has ${ui.selects} filter(s), expected 2 (status and country)`)
    if (ui.hasTable) ok(`The table rendered (${ui.rows} rows, headers: ${ui.headers.filter(Boolean).join(' | ')})`)
    else fail('The clusters table did not render')
    if (ui.rows === 0) console.log('  [NOTE] no clusters on the dev site yet; the table is empty')
  }

  // ════════════════════════════════════════════════════════════════
  // 11. UI: the ranking page shows the Status column
  // ════════════════════════════════════════════════════════════════
  console.log('\n── 11. UI: ranking status column ──')
  await navAndWait(page, `${base}/${lang}/gdcluster/ranking`, 180000)
  await new Promise(r => setTimeout(r, 3000))
  const rankingClicked = await page.evaluate((es) => {
    const labels = es ? ['Clústeres'] : ['Clusters']
    const buttons = Array.from(document.querySelectorAll('button'))
    const tab = buttons.find((b) => labels.some((l) => (b.textContent || '').includes(l)))
    if (!tab) return false
    tab.click()
    return true
  }, es)
  await new Promise(r => setTimeout(r, 1500))
  if (!rankingClicked) {
    fail('The ranking page has no Clusters tab')
  } else {
    const headers = await page.evaluate(() =>
      Array.from(document.querySelectorAll('table thead th')).map((th) => (th.textContent || '').trim()))
    const hasStatus = headers.some((h) => h === 'Status' || h === 'Estado')
    if (hasStatus) ok(`The cluster ranking shows the status column (${headers.filter(Boolean).join(' | ')})`)
    else fail(`The cluster ranking has no status column (headers: ${headers.filter(Boolean).join(' | ')})`)
  }

  // ════════════════════════════════════════════════════════════════
  // 12. Invitation: accept a nonexistent id → 404 (auth validation)
  // ════════════════════════════════════════════════════════════════
  console.log('\n── 12. Invitation: accept nonexistent ──')
  const accRes = await authFetch(`${base}/api/cluster/invitation/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress: wallet, invitationId: 999999 }),
  })
  if (accRes.status === 404) ok('POST /api/cluster/invitation/accept (nonexistent) → 404')
  else { console.log(`  accept: ${accRes.status} ${(await accRes.text()).slice(0, 80)}`); fail(`accept → ${accRes.status}`) }

  await browser.close()
  const failures = summary(t0); process.exit(failures > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
