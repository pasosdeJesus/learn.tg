/**
 * Backup confirmation of the in-app wallet (R-#249, moved here from R-#184).
 *
 * The recovery phrase is shown once, when the wallet is created. Before the wallet
 * counts as backed up the user has to type three of its words, in random positions:
 * pressing "I saved them" proved nothing, and a user who copied nothing loses the
 * wallet on the next device.
 */

/** `localStorage` flag (not a secret): the user passed the three-word check. */
export const BACKUP_CONFIRMED_KEY = 'learn.tg.wallet.backupConfirmed'

export const VERIFY_WORDS = 3

/**
 * Distinct 1-based positions to ask for, sorted so the form reads left to right.
 * `random` is injectable so the tests are deterministic.
 */
export function pickVerifyPositions(
  wordCount: number,
  count = VERIFY_WORDS,
  random: () => number = defaultRandom,
): number[] {
  const total = Math.max(0, Math.floor(wordCount))
  const wanted = Math.min(count, total)
  const chosen = new Set<number>()
  let guard = 0
  while (chosen.size < wanted && guard < total * 50) {
    guard += 1
    chosen.add(1 + Math.floor(random() * total))
  }
  // Relleno determinista si el generador devolviera siempre el mismo valor.
  for (let position = 1; position <= total && chosen.size < wanted; position += 1) {
    chosen.add(position)
  }
  return [...chosen].sort((a, b) => a - b)
}

function defaultRandom(): number {
  const cryptoObj = (globalThis as { crypto?: Crypto }).crypto
  if (!cryptoObj?.getRandomValues) return Math.random()
  const bytes = new Uint32Array(1)
  cryptoObj.getRandomValues(bytes)
  return bytes[0] / 2 ** 32
}

/**
 * Checks the typed words against the phrase. Case-insensitive and trimmed (the
 * wordlist is English lowercase, and a trailing space must not fail the user).
 */
export function verifyWords(
  words: string[],
  inputs: Record<number, string>,
): { ok: boolean; wrong: number[] } {
  const wrong: number[] = []
  for (const [positionText, value] of Object.entries(inputs)) {
    const position = Number(positionText)
    const expected = (words[position - 1] || '').trim().toLowerCase()
    const given = (value || '').trim().toLowerCase()
    if (!expected || given !== expected) wrong.push(position)
  }
  return { ok: wrong.length === 0 && Object.keys(inputs).length > 0, wrong }
}

/** Marks the backup as confirmed for this device. */
export function markBackupConfirmed(): void {
  try {
    localStorage.setItem(BACKUP_CONFIRMED_KEY, '1')
  } catch {
    // localStorage can be unavailable (private mode): the check is a reminder only.
  }
}

/** Whether this device recorded a confirmed backup. */
export function isBackupConfirmed(): boolean {
  try {
    return localStorage.getItem(BACKUP_CONFIRMED_KEY) === '1'
  } catch {
    return false
  }
}
