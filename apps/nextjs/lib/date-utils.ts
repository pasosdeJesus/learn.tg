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
