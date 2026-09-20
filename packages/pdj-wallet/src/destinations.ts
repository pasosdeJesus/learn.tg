/**
 * Destinations this wallet has already sent funds to (R-#253).
 *
 * A **new** destination always requires the device gesture, even inside the grace
 * window of `USER_VERIFICATION_GRACE_MS`: that stops an automated or hostile flow
 * from draining the wallet to an address the user never used. Repeated transfers to
 * a known address stay silent within the window.
 *
 * Stored per wallet address in `localStorage` (not a secret; only addresses), with
 * an in-memory fallback when `localStorage` is unavailable (private mode, Node).
 */

const PREFIX = 'learn.tg.pdj-wallet.destinations.'
/** Cap so the list cannot grow without bound. */
const MAX_DESTINATIONS = 200

const memory = new Map<string, Set<string>>()

function storage(): Storage | null {
  try {
    return (globalThis as { localStorage?: Storage }).localStorage ?? null
  } catch {
    return null
  }
}

function load(wallet: string): Set<string> {
  const key = wallet.toLowerCase()
  const cached = memory.get(key)
  if (cached) return cached
  const set = new Set<string>()
  const raw = storage()?.getItem(PREFIX + key)
  if (raw) {
    try {
      for (const item of JSON.parse(raw) as string[]) set.add(String(item).toLowerCase())
    } catch {
      // Lista corrupta: se empieza de cero (sólo provoca pedir el gesto de nuevo).
    }
  }
  memory.set(key, set)
  return set
}

/** Whether the wallet has already sent funds to `destination`. */
export function isKnownDestination(wallet: string, destination: string): boolean {
  if (!wallet || !destination) return false
  return load(wallet).has(destination.toLowerCase())
}

/** Records `destination` for `wallet` after a successful transfer. */
export function rememberDestination(wallet: string, destination: string): void {
  if (!wallet || !destination) return
  const set = load(wallet)
  set.add(destination.toLowerCase())
  while (set.size > MAX_DESTINATIONS) {
    const first = set.values().next().value
    if (first === undefined) break
    set.delete(first)
  }
  try {
    storage()?.setItem(PREFIX + wallet.toLowerCase(), JSON.stringify([...set]))
  } catch {
    // Sin persistencia: queda sólo en memoria (se pedirá el gesto tras recargar).
  }
}

/** Forgets every destination (tests, and when the wallet is deleted). */
export function clearDestinations(wallet?: string): void {
  if (wallet) {
    memory.delete(wallet.toLowerCase())
  } else {
    memory.clear()
  }
  const s = storage()
  if (!s) return
  try {
    for (let i = s.length - 1; i >= 0; i -= 1) {
      const key = s.key(i)
      if (!key?.startsWith(PREFIX)) continue
      if (!wallet || key === PREFIX + wallet.toLowerCase()) s.removeItem(key)
    }
  } catch {
    // Nada que limpiar.
  }
}
