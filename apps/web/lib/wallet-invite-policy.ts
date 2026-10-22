/**
 * Política de quién puede **invitar** una billetera (R-#265 §3.2, motor `wallet` m#50 §7).
 *
 * El motor exige que el consumidor afirme `inviterVerified` —"solo usuarios verificados
 * pueden invitar"— y no gestiona la verificación (m `doc/identidad-multibilletera.md` §7).
 * En learn.tg la barra de "perfil confiable" que ya existe es el **puntaje de perfil ≥ 50**:
 * es el mismo que exigen las recompensas on-chain y el que el panel de admin marca en verde.
 *
 * Excepción (2026-10-21): una cuenta nueva (p. ej. la billetera in-app recién creada) puede
 * invitar a una billetera que **ya pertenece a una cuenta verificada** (puntaje ≥ 50,
 * pasaporte de Self o verificación de iglesia). No debilita el anti-sybil: la billetera
 * invitada **debe firmar** el `accept` en su propio dispositivo, así que sin su
 * consentimiento no hay unión; y lo que se une es una cuenta ya verificada, no una nueva.
 * Así un usuario con historial (p. ej. OKX) puede empezar con la billetera in-app e invitar
 * la que ya tenía, en vez de tener que hacerlo en la dirección contraria.
 *
 * Se aísla en un módulo para que cambiarlo sea una sola edición y quede probado.
 */

export const INVITER_MIN_PROFILE_SCORE = 50

/** Datos de confianza de una cuenta (`usuario`). */
export interface AccountTrust {
  profilescore?: number | null
  passport_name?: string | null
  verified_church_relationship?: string | null
}

export interface InviterPolicy {
  allowed: boolean
  reason?: 'profile-score'
  profileScore: number
}

/** `true` si la cuenta tiene alguna verificación (perfil, Self o iglesia). */
export function isVerifiedAccount(usuario: AccountTrust | null | undefined): boolean {
  if (!usuario) return false
  const profileScore = Number(usuario.profilescore ?? 0)
  return (
    profileScore >= INVITER_MIN_PROFILE_SCORE ||
    Boolean(String(usuario.passport_name ?? '').trim()) ||
    Boolean(usuario.verified_church_relationship)
  )
}

/**
 * `true` si la cuenta puede invitar otra billetera.
 *
 * `invitee` son los datos de la cuenta **invitada** (si la dirección ya existe en la
 * base). Una billetera invitada que ya es de una cuenta verificada habilita la
 * invitación aunque quien invita tenga perfil bajo.
 */
export function canInviteWallet(
  usuario: AccountTrust | null | undefined,
  invitee?: AccountTrust | null,
): InviterPolicy {
  const profileScore = Number(usuario?.profilescore ?? 0)
  const allowed = profileScore >= INVITER_MIN_PROFILE_SCORE || isVerifiedAccount(invitee)
  return allowed ? { allowed, profileScore } : { allowed, reason: 'profile-score', profileScore }
}
