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

export interface AccountInvitation {
  id: number
  direccion_invitada: string
  usuario_id: number
  expires_at?: string | null
}

async function readInvitations(res: Response): Promise<AccountInvitation[]> {
  const data = (await res.json().catch(() => null)) as { invitations?: unknown } | null
  return Array.isArray(data?.invitations) ? (data!.invitations as AccountInvitation[]) : []
}

/**
 * Invitaciones **pendientes** de la cuenta de la sesión (§3.2, camino entre
 * dispositivos). `null` sin sesión o si la lectura falla.
 */
export async function fetchAccountInvitations(
  walletAddress: string,
): Promise<AccountInvitation[] | null> {
  try {
    const res = await fetch(`/api/wallet?walletAddress=${encodeURIComponent(walletAddress)}`)
    if (!res.ok) return null
    return await readInvitations(res)
  } catch {
    return null
  }
}

export type InviteResult =
  | { ok: true; invitations: AccountInvitation[] }
  | { ok: false; reason: 'unauthorized' | 'unverified' | 'conflict' | 'invalid' | 'error' }

/**
 * Invita una **dirección** a unirse a la cuenta de la sesión (§3.2). Sirve para el
 * caso **entre dispositivos**: la billetera invitada firma y acepta desde su propio
 * dispositivo (`probeInvitation`/`acceptInvitationRequest`). El servidor exige que
 * quien invita tenga perfil suficiente (`lib/wallet-invite-policy.ts`).
 */
export async function inviteWalletAddress(
  walletAddress: string,
  address: string,
): Promise<InviteResult> {
  try {
    const res = await fetch('/api/wallet/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, address }),
    })
    if (res.status === 401) return { ok: false, reason: 'unauthorized' }
    if (res.status === 403) return { ok: false, reason: 'unverified' }
    if (res.status === 409) return { ok: false, reason: 'conflict' }
    if (res.status === 400) return { ok: false, reason: 'invalid' }
    if (!res.ok) return { ok: false, reason: 'error' }
    return { ok: true, invitations: await readInvitations(res) }
  } catch {
    return { ok: false, reason: 'error' }
  }
}

export type CancelInvitationResult =
  | { ok: true; cancelled: boolean; invitations: AccountInvitation[] }
  | { ok: false; reason: 'unauthorized' | 'invalid' | 'error' }

/** Cancela una invitación pendiente de la cuenta (idempotente). */
export async function cancelInvitationRequest(
  walletAddress: string,
  address: string,
): Promise<CancelInvitationResult> {
  try {
    const res = await fetch('/api/wallet/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, address }),
    })
    if (res.status === 401) return { ok: false, reason: 'unauthorized' }
    if (res.status === 400) return { ok: false, reason: 'invalid' }
    if (!res.ok) return { ok: false, reason: 'error' }
    const data = (await res.json().catch(() => null)) as {
      cancelled?: unknown
      invitations?: unknown
    } | null
    return {
      ok: true,
      cancelled: data?.cancelled === true,
      invitations: Array.isArray(data?.invitations)
        ? (data!.invitations as AccountInvitation[])
        : [],
    }
  } catch {
    return { ok: false, reason: 'error' }
  }
}

export type ProbeInvitationResult =
  | { ok: true; invitedBy: string | null; expiresAt?: string | null }
  | { ok: false; reason: 'no-invitation' | 'invalid' | 'error' }

/**
 * Pregunta si esta billetera tiene una invitación pendiente, **sin** aceptarla
 * (`POST /api/wallet/accept` sin `confirm`). La firma SIWE es la credencial: sólo
 * quien controla la dirección se entera de la invitación, así que el endpoint no
 * revela emparejamientos de cuentas.
 */
export async function probeInvitation(
  message: string,
  signature: string,
): Promise<ProbeInvitationResult> {
  try {
    const res = await fetch('/api/wallet/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, signature }),
    })
    if (res.status === 404) return { ok: false, reason: 'no-invitation' }
    if (res.status === 400) return { ok: false, reason: 'invalid' }
    if (!res.ok) return { ok: false, reason: 'error' }
    const data = (await res.json().catch(() => null)) as {
      invitedBy?: unknown
      expiresAt?: unknown
    } | null
    return {
      ok: true,
      invitedBy: typeof data?.invitedBy === 'string' ? data.invitedBy : null,
      expiresAt: typeof data?.expiresAt === 'string' ? data.expiresAt : null,
    }
  } catch {
    return { ok: false, reason: 'error' }
  }
}

export type AcceptInvitationResult =
  | { ok: true; invitedBy: string | null }
  | { ok: false; reason: 'no-invitation' | 'owned-by-other' | 'invalid' | 'error' }

/** Acepta la invitación (consentimiento explícito) y enlaza la billetera a la cuenta. */
export async function acceptInvitationRequest(
  message: string,
  signature: string,
): Promise<AcceptInvitationResult> {
  try {
    const res = await fetch('/api/wallet/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, signature, confirm: true }),
    })
    if (res.status === 404) return { ok: false, reason: 'no-invitation' }
    if (res.status === 409) return { ok: false, reason: 'owned-by-other' }
    if (res.status === 400) return { ok: false, reason: 'invalid' }
    if (!res.ok) return { ok: false, reason: 'error' }
    const data = (await res.json().catch(() => null)) as { invitedBy?: unknown } | null
    return { ok: true, invitedBy: typeof data?.invitedBy === 'string' ? data.invitedBy : null }
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
