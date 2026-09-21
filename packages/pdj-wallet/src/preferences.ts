/**
 * Preferencia de desbloqueo del usuario (R-#246 §14 item 2, adoptado del repaso de
 * Rabby).
 *
 * Rabby recuerda el método elegido (`unlockPreferredMethod`) y no vuelve a lanzar el
 * gesto si el usuario pulsó "usar la clave". Sin esto, abrir el diálogo con una
 * passkey registrada lanzaba el gesto siempre, aunque el usuario lo hubiera
 * descartado la vez anterior.
 *
 * Se guarda en `localStorage` (no es un secreto: sólo dice qué le gusta al usuario)
 * con clave propia del paquete, no de la aplicación.
 */
const KEY = 'pdj-wallet:unlockPreference'

export type UnlockPreference = 'password' | 'biometric'

function storage(): Storage | null {
  const candidate = (globalThis as { localStorage?: Storage }).localStorage
  return candidate ?? null
}

export function getUnlockPreference(): UnlockPreference | null {
  try {
    const value = storage()?.getItem(KEY)
    return value === 'password' || value === 'biometric' ? value : null
  } catch {
    return null
  }
}

export function setUnlockPreference(preference: UnlockPreference): void {
  try {
    storage()?.setItem(KEY, preference)
  } catch {
    // almacenamiento bloqueado: se comporta como si no hubiera preferencia
  }
}

export function clearUnlockPreference(): void {
  try {
    storage()?.removeItem(KEY)
  } catch {
    // idem
  }
}
