#!/usr/bin/env node
/**
 * Smoke test: CalDAV full cycle — create, list, verify, delete.
 * Uses CALDAV_URL, CALDAV_USER, CALDAV_PASS from env (loaded by bin/m test:e2e).
 *
 * Execution:
 *   bin/m test:e2e --smoke
 *   or: node e2e/smoke/caldav-completa.spec.mjs
 */

const CALDAV_URL = process.env.CALDAV_URL || ''
const CALDAV_USER = process.env.CALDAV_USER || ''
const CALDAV_PASS = process.env.CALDAV_PASS || ''

if (!CALDAV_URL || !CALDAV_USER || !CALDAV_PASS) {
  console.log('ℹ️  CALDAV not configured — skipping CalDAV full cycle test')
  process.exit(0)
}

const auth = Buffer.from(`${CALDAV_USER}:${CALDAV_PASS}`).toString('base64')
const EVENT_UID = `smoke-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

const now = new Date()
const startDate = new Date(now.getTime() + 60 * 60 * 1000)
const endDate = new Date(startDate.getTime() + 30 * 60 * 1000)

function formatCalDate(date) {
  return date.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'
}

function buildICalEvent(uid, summary, start, end) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//learn.tg//SmokeTest//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${formatCalDate(start)}`,
    `DTEND:${formatCalDate(end)}`,
    `SUMMARY:${summary}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

async function listEvents() {
  const body = `<?xml version="1.0" encoding="utf-8"?>
<C:calendar-query xmlns:C="urn:ietf:params:xml:ns:caldav">
  <C:prop><C:calendar-data/></C:prop>
</C:calendar-query>`
  const res = await fetch(CALDAV_URL, {
    method: 'REPORT',
    headers: { 'Authorization': `Basic ${auth}`, 'Depth': '1', 'Content-Type': 'application/xml' },
    body,
  })
  const text = await res.text()
  const uids = [...text.matchAll(/<href>([^<]+)<\/href>/g)]
    .map(m => m[1].split('/').pop()?.replace('.ics', ''))
    .filter(Boolean)
  return uids
}

async function createEvent() {
  const ical = buildICalEvent(EVENT_UID, '🧪 Smoke test — learn.tg', startDate, endDate)
  const res = await fetch(`${CALDAV_URL}${EVENT_UID}.ics`, {
    method: 'PUT',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'text/calendar' },
    body: ical,
  })
  return res.status
}

async function deleteEvent() {
  const res = await fetch(`${CALDAV_URL}${EVENT_UID}.ics`, {
    method: 'DELETE',
    headers: { 'Authorization': `Basic ${auth}` },
  })
  return res.status
}

console.log('📂 CalDAV full cycle test')
console.log(`   URL: ${CALDAV_URL}`)
console.log(`   UID: ${EVENT_UID}`)

let failed = false

try {
  // 1. List before
  const before = await listEvents()
  console.log(`\n📋 Before: ${before.length} events`)

  // 2. Create
  const createStatus = await createEvent()
  console.log(`📝 Create: ${createStatus}`)
  if (createStatus !== 201) {
    console.log(`   ❌ Expected 201, got ${createStatus}`)
    failed = true
  }

  // 3. List after
  const after = await listEvents()
  console.log(`📋 After: ${after.length} events`)
  const found = after.includes(EVENT_UID)
  console.log(`🔍 Event found: ${found ? '✅' : '❌'}`)
  if (!found) failed = true

  // 4. Delete
  const delStatus = await deleteEvent()
  console.log(`🗑️  Delete: ${delStatus}`)
  if (delStatus !== 200 && delStatus !== 204) {
    console.log(`   ⚠️  Expected 200/204, got ${delStatus}`)
  }

  // 5. Verify deleted
  const final = await listEvents()
  const removed = !final.includes(EVENT_UID)
  console.log(`✅ Removed: ${removed ? '✅' : '⚠️'}`)

  if (failed) {
    console.log('\n❌ CalDAV full cycle test FAILED')
    process.exit(1)
  }

  console.log('\n✅ CalDAV full cycle test passed')
} catch (error) {
  console.error('❌ Error:', error instanceof Error ? error.message : String(error))
  process.exit(1)
}
