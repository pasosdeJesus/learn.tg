#!/usr/bin/env node
/**
 * Smoke test: CalDAV connectivity to Radicale via HTTP directo.
 * Uses CALDAV_URL, CALDAV_USER, CALDAV_PASS from env (loaded by bin/m test:e2e).
 *
 * Execution:
 *   bin/m test:e2e --smoke
 *   or: node e2e/smoke/caldav-http.spec.mjs
 */

const CALDAV_URL = process.env.CALDAV_URL || ''
const CALDAV_USER = process.env.CALDAV_USER || ''
const CALDAV_PASS = process.env.CALDAV_PASS || ''

if (!CALDAV_URL || !CALDAV_USER || !CALDAV_PASS) {
  console.log('ℹ️  CALDAV not configured — skipping CalDAV smoke test')
  process.exit(0)
}

const auth = Buffer.from(`${CALDAV_USER}:${CALDAV_PASS}`).toString('base64')

console.log('📂 CalDAV: Conectando a Radicale via HTTP...')
console.log(`   URL: ${CALDAV_URL}`)
console.log(`   Usuario: ${CALDAV_USER}`)

let failed = false

try {
  // 1. PROPFIND
  console.log('\n🔍 PROPFIND...')
  const propfindRes = await fetch(CALDAV_URL, {
    method: 'PROPFIND',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Depth': '1',
      'Content-Type': 'application/xml',
    },
    body: `<?xml version="1.0" encoding="utf-8"?>
<propfind xmlns="DAV:">
  <prop>
    <resourcetype/>
    <displayname/>
  </prop>
</propfind>`,
  })
  console.log(`   Status: ${propfindRes.status}`)
  if (propfindRes.status !== 207) {
    console.log(`   ❌ Expected 207 Multi-Status, got ${propfindRes.status}`)
    failed = true
  }

  // 2. REPORT
  console.log('\n🔍 REPORT (calendar-query)...')
  const reportRes = await fetch(CALDAV_URL, {
    method: 'REPORT',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Depth': '1',
      'Content-Type': 'application/xml',
    },
    body: `<?xml version="1.0" encoding="utf-8"?>
<C:calendar-query xmlns:C="urn:ietf:params:xml:ns:caldav">
  <C:prop><C:calendar-data/></C:prop>
</C:calendar-query>`,
  })
  console.log(`   Status: ${reportRes.status}`)
  if (reportRes.status !== 207) {
    console.log(`   ❌ Expected 207 Multi-Status, got ${reportRes.status}`)
    failed = true
  }

  if (failed) {
    console.log('\n❌ CalDAV smoke test FAILED')
    process.exit(1)
  }

  console.log('\n✅ CalDAV smoke test passed')
} catch (error) {
  console.error('❌ Error:', error instanceof Error ? error.message : String(error))
  process.exit(1)
}
