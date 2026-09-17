import type { PrivateKey } from './signer.js'

/**
 * Desbloqueo por pestaña.
 *
 * La clave descifrada vive solo en memoria, así que cualquier recarga bloqueaba
 * la billetera otra vez y los modales de donación/compra volvían a pedir el PIN
 * aunque la cabecera mostrara una sesión válida (el operador lo reportó el
 * 2026-09-16). Recordarla en `sessionStorage` mantiene la billetera usable
 * mientras dure la pestaña: el navegador lo borra al cerrarla, no se comparte
 * con otras pestañas, y `lockWallet()` (el ✕ de la cabecera) o el vencimiento lo
 * eliminan antes.
 *
 * Compromiso: mientras la entrada exista, código que corra en la página (XSS)
 * puede leer la clave. Es la misma ventana en la que el usuario ya firma sin
 * PIN, pero se extiende a las recargas; por eso el vencimiento es corto y se
 * renueva solo cuando la billetera se usa.
 */
export const SESSION_UNLOCK_TTL_MS = 30 * 60 * 1000

const STORAGE_KEY = 'learn.tg:in-app-wallet:unlocked'

export interface RememberedUnlock {
  address: string
  privateKey: PrivateKey
  expiresAt: number
}

/** `sessionStorage` no existe en Node ni en algunos modos privados. */
function sessionStore(): Storage | null {
  try {
    const store = (globalThis as { sessionStorage?: Storage }).sessionStorage
    return store ?? null
  } catch {
    return null
  }
}

export function rememberUnlockedSession(
  address: string,
  privateKey: PrivateKey,
  ttl: number = SESSION_UNLOCK_TTL_MS,
): void {
  const store = sessionStore()
  if (!store) return
  const entry: RememberedUnlock = { address, privateKey, expiresAt: Date.now() + ttl }
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(entry))
  } catch {
    // p. ej. cuota llena: sin recuerdo, la billetera solo pide el PIN otra vez
  }
}

export function readUnlockedSession(): RememberedUnlock | null {
  const store = sessionStore()
  if (!store) return null
  try {
    const raw = store.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<RememberedUnlock>
    if (!parsed.address || !parsed.privateKey || typeof parsed.expiresAt !== 'number') {
      store.removeItem(STORAGE_KEY)
      return null
    }
    if (parsed.expiresAt <= Date.now()) {
      store.removeItem(STORAGE_KEY)
      return null
    }
    return { address: parsed.address, privateKey: parsed.privateKey, expiresAt: parsed.expiresAt }
  } catch {
    try {
      store.removeItem(STORAGE_KEY)
    } catch {
      // sin nada que limpiar
    }
    return null
  }
}

export function forgetUnlockedSession(): void {
  const store = sessionStore()
  if (!store) return
  try {
    store.removeItem(STORAGE_KEY)
  } catch {
    // sin nada que limpiar
  }
}
