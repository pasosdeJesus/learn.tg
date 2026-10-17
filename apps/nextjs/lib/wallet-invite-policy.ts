/**
 * Política de quién puede **invitar** una billetera (R-#265 §3.2, motor `wallet` m#50 §7).
 *
 * El motor exige que el consumidor afirme `inviterVerified` —"solo usuarios verificados
 * pueden invitar"— y no gestiona la verificación (m `doc/identidad-multibilletera.md` §7).
 * En learn.tg la barra de "perfil confiable" que ya existe es el **puntaje de perfil ≥ 50**:
 * es el mismo que exigen las recompensas on-chain y el que el panel de admin marca en verde.
 * Se aísla en un módulo para que cambiarlo sea una sola edición y quede probado.
 */

export const INVITER_MIN_PROFILE_SCORE = 50

export interface InviterPolicy {
  allowed: boolean
  reason?: 'profile-score'
  profileScore: number
}

/** `true` si la cuenta tiene el perfil suficiente para invitar otra billetera. */
export function canInviteWallet(usuario: { profilescore?: number | null } | null | undefined): InviterPolicy {
  const profileScore = Number(usuario?.profilescore ?? 0)
  const allowed = profileScore >= INVITER_MIN_PROFILE_SCORE
  return allowed ? { allowed, profileScore } : { allowed, reason: 'profile-score', profileScore }
}
