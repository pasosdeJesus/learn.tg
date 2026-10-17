/**
 * ¿Hay otra billetera disponible en este dispositivo además de la conectada?
 *
 * "Vincular otra billetera" (R-#265 §3.2) sólo tiene sentido si existe otra con la que
 * firmar. Sin esta comprobación el botón aparecía siempre y, en un navegador con una
 * sola billetera conectada, lo único que podía hacer era explicar que no había nada
 * que vincular. Se consideran disponibles:
 *
 * - la billetera **de la aplicación**, si no es la de la sesión;
 * - una billetera **externa** (EIP-6963/`window.ethereum`) con otra cuenta permitida;
 * - más de un proveedor anunciado (MetaMask + Rabby, por ejemplo);
 * - la externa cuando la sesión es la billetera de la aplicación (su cuenta se pide al
 *   pulsar, con `eth_requestAccounts`).
 */
export interface AnotherWalletInput {
  /** Billetera de la sesión (la conectada). */
  sessionAddress?: string | null
  /** Dirección de la billetera de la aplicación, si el dispositivo tiene una. */
  inAppAddress?: string | null
  hasInAppWallet: boolean
  externalAvailable: boolean
  /** Cuentas que el sitio ya tiene permitidas en la billetera externa (`eth_accounts`). */
  externalAccounts?: string[]
  /** Proveedores EIP-6963 anunciados. */
  announcedCount?: number
}

export function hasAnotherWallet(input: AnotherWalletInput): boolean {
  const connected = (input.sessionAddress || '').toLowerCase()
  if (!connected) return false

  const inApp = (input.inAppAddress || '').toLowerCase()
  if (input.hasInAppWallet && (!inApp || inApp !== connected)) return true
  if (!input.externalAvailable) return false

  if ((input.announcedCount || 0) > 1) return true
  const accounts = (input.externalAccounts || [])
    .map((account) => account.toLowerCase())
    .filter(Boolean)
  if (accounts.length > 0) return accounts.some((account) => account !== connected)

  // La sesión es la billetera de la aplicación: la externa puede ser otra cuenta.
  return !!inApp && inApp === connected
}
