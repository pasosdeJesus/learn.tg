/**
 * Cliente de la **cuenta** multibilletera (R-#265 / m#50).
 *
 * Envoltorio de las rutas `/api/wallet*`: la sesión (cookie NextAuth) es la
 * credencial y `walletAddress` es la pista de la billetera conectada. El motor
 * `wallet` es dueño de las filas; aquí sólo se leen y se piden enlaces o
 * desenlaces.
 */

export interface AccountWallet {
  id: number
  usuario_id: number
  billetera: string
  linked_at?: string | null
}

async function readWallets(res: Response): Promise<AccountWallet[]> {
  const data = (await res.json().catch(() => null)) as { wallets?: unknown } | null
  return Array.isArray(data?.wallets) ? (data!.wallets as AccountWallet[]) : []
}

/**
 * Lista las billeteras de la cuenta de la sesión (la más antigua primero).
 * `null` cuando no hay sesión o la lectura falla; el llamador decide el respaldo.
 */
export async function fetchAccountWallets(walletAddress: string): Promise<AccountWallet[] | null> {
  try {
    const res = await fetch(`/api/wallet?walletAddress=${encodeURIComponent(walletAddress)}`)
    if (!res.ok) return null
    return await readWallets(res)
  } catch {
    return null
  }
}

export type UnlinkResult =
  | { ok: true; wallets: AccountWallet[] }
  | { ok: false; reason: 'unauthorized' | 'last-wallet' | 'invalid' | 'error' }

/**
 * Desvincula una billetera **secundaria** de la cuenta. El servidor se niega a dejar
 * la cuenta sin billeteras (`409`), lo que aquí se traduce en `reason: 'last-wallet'`.
 */
export async function unlinkAccountWalletRequest(
  walletAddress: string,
  address: string,
): Promise<UnlinkResult> {
  try {
    const res = await fetch('/api/wallet/unlink', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, address }),
    })
    if (res.status === 401) return { ok: false, reason: 'unauthorized' }
    if (res.status === 409) return { ok: false, reason: 'last-wallet' }
    if (!res.ok) return { ok: false, reason: 'error' }
    return { ok: true, wallets: await readWallets(res) }
  } catch {
    return { ok: false, reason: 'error' }
  }
}

export type LinkResult =
  | { ok: true; wallets: AccountWallet[] }
  | { ok: false; reason: 'unauthorized' | 'owned-by-other' | 'invalid' | 'error' }

/**
 * Enlaza una **segunda** billetera ya firmada (SIWE). `message`/`signature` los
 * produce la billetera nueva; `walletAddress` es la billetera de la sesión. La ruta
 * verifica la firma y delega el enlace al motor.
 */
export async function linkAccountWallet(args: {
  walletAddress: string
  message: string
  signature: string
}): Promise<LinkResult> {
  try {
    const res = await fetch('/api/wallet/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    })
    if (res.status === 401) return { ok: false, reason: 'unauthorized' }
    if (res.status === 409) return { ok: false, reason: 'owned-by-other' }
    if (res.status === 400) return { ok: false, reason: 'invalid' }
    if (!res.ok) return { ok: false, reason: 'error' }
    return { ok: true, wallets: await readWallets(res) }
  } catch {
    return { ok: false, reason: 'error' }
  }
}
