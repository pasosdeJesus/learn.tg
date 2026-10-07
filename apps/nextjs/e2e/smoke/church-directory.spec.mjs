import 'dotenv/config'
import axios from 'axios'
import https from 'https'

// R-#164 Fase 1 — church directory (smoke, HTTP).
//   SITE_URL=https://learn.tg:9001 bin/m test:e2e --smoke church-directory
//
// Public endpoints only (no Chrome, no auth).

const BASE_URL = process.env.SITE_URL || 'https://learn.tg:9001'
const api = axios.create({
  baseURL: BASE_URL,
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  headers: { 'User-Agent': 'ChurchDirectory-E2E/1.0' },
  validateStatus: () => true,
})

let failed = 0
const ok = (m) => console.log(`  [OK] ${m}`)
const fail = (m) => { console.log(`  [FAIL] ${m}`); failed++ }

async function main() {
  console.log(`📂 Church directory smoke — ${BASE_URL}\n`)

  // 1. Directory list shape
  const list = await api.get('/api/directory/churches?not_recommended=1')
  if (list.status !== 200) fail(`GET /api/directory/churches → ${list.status}`)
  else {
    const { churches, total, notRecommended } = list.data || {}
    if (!Array.isArray(churches)) fail('churches is not an array')
    else if (typeof total !== 'number') fail('total is not a number')
    else if (!Array.isArray(notRecommended)) fail('notRecommended is not an array')
    else ok(`list → 200 (total=${total}, notRecommended=${notRecommended.length})`)

    const bad = (churches || []).find(
      (c) => c.id == null || !c.name || c.reputationScore == null || !('activityScore' in c),
    )
    if (bad) fail(`entry missing fields: ${JSON.stringify(bad).slice(0, 120)}`)
    else ok(`all ${churches.length} entries have id/name/reputationScore/activityScore`)
  }

  // 2. Detail of the first church
  const firstId = list.data?.churches?.[0]?.id
  if (firstId != null) {
    const det = await api.get(`/api/directory/churches/${firstId}`)
    if (det.status === 200 && det.data?.church?.id === firstId) ok(`detail #${firstId} → 200`)
    else fail(`detail #${firstId} → ${det.status}`)
  } else {
    ok('no church in the directory — detail test skipped')
  }

  // 3. Missing church
  const missing = await api.get('/api/directory/churches/99999999')
  if (missing.status === 404) ok('missing church → 404')
  else fail(`missing church → ${missing.status} (expected 404)`)

  // 4. Country filter stays consistent
  const sl = await api.get('/api/directory/churches?country=SL')
  if (sl.status !== 200) fail(`country filter → ${sl.status}`)
  else if ((sl.data?.churches || []).every((c) => c.countryAlfa2 === 'SL')) ok('country=SL filter consistent')
  else fail('country=SL returned a church from another country')

  // 5. Auth: claim requires a session, admin listing requires a verifier
  const claim = await api.post('/api/directory/churches/1/claim')
  if (claim.status === 401) ok('claim without a session → 401')
  else fail(`claim without a session → ${claim.status} (expected 401)`)

  const admin = await api.patch('/api/admin/churches/1/list', { is_listed: true })
  if (admin.status === 403 || admin.status === 401) ok(`admin list without a verifier → ${admin.status}`)
  else fail(`admin list without a verifier → ${admin.status} (expected 403)`)

  // 6. The public page renders
  const page = await api.get('/en/directory/churches')
  if (page.status === 200 && typeof page.data === 'string') ok('/en/directory/churches → 200')
  else fail(`/en/directory/churches → ${page.status}`)

  console.log(`\n${failed === 0 ? '✅' : '❌'} ${failed} failure(s)`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => { console.error('FATAL:', e instanceof Error ? e.message : String(e)); process.exit(1) })
