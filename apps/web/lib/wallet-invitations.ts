/**
 * Invitaciones entre dispositivos (R-#265 §3.2, motor `wallet` m#50).
 *
 * `POST /api/wallet/link` exige las **dos** billeteras en el mismo navegador, en el
 * acto. La invitación cubre la que firma **después, en su propio dispositivo**: la
 * cuenta invita una dirección, y esa billetera lo acepta al entrar.
 *
 * Este módulo decide qué hacer cuando el ingreso falla: si la billetera tiene una
 * invitación pendiente se le **pregunta** (el consentimiento es explícito: unirla sin
 * querer daría acceso a su avance y credenciales a quien la invitó) y, si acepta, se
 * enlaza y se reintenta el ingreso con la **misma** firma.
 */

import { acceptInvitationRequest, probeInvitation } from '@/lib/wallet-account'

export type InvitationOutcome = 'none' | 'declined' | 'accepted' | 'error'

export type InvitationLang = 'en' | 'es'

/** Texto de la confirmación explícita; `invitedBy` es el `nusuario` de quien invitó. */
export function invitationPrompt(lang: InvitationLang, invitedBy: string | null): string {
  if (lang === 'es') {
    return invitedBy
      ? `La cuenta "${invitedBy}" invitó esta billetera. ¿Unirla a esa cuenta? Compartirás su avance, puntajes y credenciales.`
      : 'Otra cuenta invitó esta billetera. ¿Unirla a esa cuenta? Compartirás su avance, puntajes y credenciales.'
  }
  return invitedBy
    ? `The account "${invitedBy}" invited this wallet. Join it? You will share its progress, scores and credentials.`
    : 'Another account invited this wallet. Join it? You will share its progress, scores and credentials.'
}

/**
 * Tras un ingreso rechazado: consulta la invitación (sólo la billetera que firma se
 * entera), pide confirmación y, si acepta, la enlaza.
 *
 * Devuelve `'accepted'` cuando el llamador debe **reintentar** el ingreso con la misma
 * `message`/`signature` (una sola firma sirve para aceptar y entrar).
 */
export async function resolveInvitationAfterAuthFailure(args: {
  message: string
  signature: string
  confirm: (invitedBy: string | null) => boolean | Promise<boolean>
}): Promise<InvitationOutcome> {
  const probe = await probeInvitation(args.message, args.signature)
  if (!probe.ok) return probe.reason === 'no-invitation' ? 'none' : 'error'

  const accepted = await args.confirm(probe.invitedBy)
  if (!accepted) return 'declined'

  const link = await acceptInvitationRequest(args.message, args.signature)
  return link.ok ? 'accepted' : 'error'
}
