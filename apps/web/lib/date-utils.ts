/**
 * Date helpers for columns stored as `timestamp without time zone`.
 *
 * Convention: those columns hold the UTC wall-clock time (naive string
 * "YYYY-MM-DD HH:MM:SS"). timestamptz columns come back as ISO strings with a
 * timezone marker. These helpers make reads/writes consistent regardless of
 * the server's or the browser's timezone (fixes 2PM → 5AM interview shifts).
 */

/** True if the string carries an explicit timezone marker. */
function hasTz(s: string): boolean {
  return /Z$|[+-]\d{2}:?\d{2}$/.test(s) || /T\d{2}:\d{2}:\d{2}\.\d{3}Z/.test(s)
}

/** Parse a DB timestamp (naive = UTC wall-clock) into a real Date. */
export function parseDbTimestamp(s?: string | null): Date | null {
  if (!s) return null
  return new Date(hasTz(s) ? s : s.replace(' ', 'T') + 'Z')
}

/** Serialize a Date as the UTC wall-clock string stored in naive columns. */
export function toDbTimestamp(d: Date): string {
  return d.toISOString().replace('T', ' ').slice(0, 19)
}

/** Format a naive-column string as "YYYY-MM-DDTHH:mm" in the LOCAL timezone
 *  (for `<input type="datetime-local">` values). */
export function dbTimestampToLocalInput(s?: string | null): string {
  const d = parseDbTimestamp(s)
  if (!d) return ''
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

/**
 * Calendar day (`YYYY-MM-DD`) of an instant **in a given IANA timezone**.
 *
 * Needed when a screen shows a schedule in a fixed timezone (the verifier's, by
 * default `UTC`) while the device may be in another: slicing the ISO string takes the
 * UTC day, which after ~19:00 on a UTC-5 device is already the next day, so the slot's
 * day did not match the calendar cell's day and the cell never lit up (evening slots
 * invisible in `VerificationScheduler`). Cells and slots must both use this helper.
 */
export function dateKeyInTimezone(instant: Date | string, tz: string): string {
  const d = typeof instant === 'string' ? new Date(instant) : instant
  if (Number.isNaN(d.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}
