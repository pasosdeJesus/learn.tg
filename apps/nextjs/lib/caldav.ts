// CalDAV client for Radicale — uses fetch() directly, no dependencies.
// See REQ/188.md for implementation details and OpenBSD/adJ notes.

const CALDAV_URL = process.env.CALDAV_URL || ''
const CALDAV_USER = process.env.CALDAV_USER || ''
const CALDAV_PASS = process.env.CALDAV_PASS || ''

function authHeader(): string {
  return 'Basic ' + Buffer.from(`${CALDAV_USER}:${CALDAV_PASS}`).toString('base64')
}

function configured(): boolean {
  return !!(CALDAV_URL && CALDAV_USER && CALDAV_PASS)
}

export interface CalDavEvent {
  uid: string
  start: Date
  end: Date
  summary?: string
}

interface ICalEvent {
  uid: string
  dtstart: string
  dtend: string
  summary?: string
}

function formatCalDate(date: Date): string {
  return date.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'
}

function parseCalDate(s: string): Date {
  const year = parseInt(s.slice(0, 4), 10)
  const month = parseInt(s.slice(4, 6), 10) - 1
  const day = parseInt(s.slice(6, 8), 10)
  const hour = parseInt(s.slice(9, 11), 10)
  const min = parseInt(s.slice(11, 13), 10)
  const sec = parseInt(s.slice(13, 15), 10)
  return new Date(Date.UTC(year, month, day, hour, min, sec))
}

function parseICalendar(ics: string): ICalEvent | null {
  const getProp = (name: string) => {
    const m = ics.match(new RegExp(`^${name}:(.+)$`, 'm'))
    return m ? m[1].trim() : undefined
  }
  const uid = getProp('UID')
  const dtstart = getProp('DTSTART')
  const dtend = getProp('DTEND')
  if (!uid || !dtstart || !dtend) return null
  return { uid, dtstart, dtend, summary: getProp('SUMMARY') }
}

/**
 * List all events in the calendar.
 * Extracts UIDs from <href> elements in REPORT response (Radicale
 * doesn't return inline calendar-data with UIDs).
 */
export async function listEvents(): Promise<CalDavEvent[]> {
  if (!configured()) return []

  const body = `<?xml version="1.0" encoding="utf-8"?>
<C:calendar-query xmlns:C="urn:ietf:params:xml:ns:caldav">
  <C:prop><C:calendar-data/></C:prop>
</C:calendar-query>`

  const res = await fetch(CALDAV_URL, {
    method: 'REPORT',
    headers: {
      'Authorization': authHeader(),
      'Depth': '1',
      'Content-Type': 'application/xml',
    },
    body,
  })

  if (res.status !== 207) return []
  const text = await res.text()

  // Extract UIDs from hrefs: /path/UID.ics
  const uids: string[] = []
  const hrefRegex = /<href>([^<]+)<\/href>/g
  let m
  while ((m = hrefRegex.exec(text)) !== null) {
    const uid = m[1].split('/').pop()?.replace('.ics', '')
    if (uid) uids.push(uid)
  }

  // Fetch each .ics to get start/end times
  const events: CalDavEvent[] = []
  for (const uid of uids) {
    try {
      const icsRes = await fetch(`${CALDAV_URL}${uid}.ics`, {
        headers: { 'Authorization': authHeader() },
      })
      if (!icsRes.ok) continue
      const ics = await icsRes.text()
      const parsed = parseICalendar(ics)
      if (parsed) {
        events.push({
          uid: parsed.uid,
          start: parseCalDate(parsed.dtstart),
          end: parseCalDate(parsed.dtend),
          summary: parsed.summary,
        })
      }
    } catch { /* skip unparseable events */ }
  }

  return events
}

/**
 * Create a new calendar event.
 * Returns the UID on success, null on failure.
 */
export async function createEvent(
  summary: string,
  start: Date,
  end: Date,
  description?: string,
  rrule?: string
): Promise<string | null> {
  if (!configured()) return null

  const uid = crypto.randomUUID()
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//learn.tg//Verification//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${formatCalDate(start)}`,
    `DTEND:${formatCalDate(end)}`,
    `SUMMARY:${summary}`,
  ]
  if (description) lines.push(`DESCRIPTION:${description}`)
  if (rrule) lines.push(`RRULE:${rrule}`)
  lines.push('END:VEVENT', 'END:VCALENDAR')

  const res = await fetch(`${CALDAV_URL}${uid}.ics`, {
    method: 'PUT',
    headers: {
      'Authorization': authHeader(),
      'Content-Type': 'text/calendar',
    },
    body: lines.join('\r\n'),
  })

  return res.status === 201 || res.status === 204 ? uid : null
}

/**
 * Delete a calendar event by UID.
 */
export async function deleteEvent(uid: string): Promise<boolean> {
  if (!configured()) return false

  const res = await fetch(`${CALDAV_URL}${uid}.ics`, {
    method: 'DELETE',
    headers: { 'Authorization': authHeader() },
  })

  return res.status === 200 || res.status === 204
}
