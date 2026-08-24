/**
 * Localized text for course purchase/access denial reasons.
 *
 * Server routes return stable machine-readable keys (see lib/course-access.ts
 * and app/api/guide/route.ts) instead of English sentences. The client maps
 * the key to the user's language via `courseAccessReasonText`.
 */

const MESSAGES: Record<string, [en: string, es: string]> = {
  premium_purchase_required: [
    'This is a premium course. Purchase it to access its guides.',
    'Este es un curso premium. Cómpralo para acceder a sus guías.',
  ],
  gd_for_christians: [
    'This course is for Christians.',
    'Este curso es para cristianos.',
  ],
  gd_pilot_countries: [
    'This course is only available in pilot countries (Colombia, Sierra Leone).',
    'Este curso solo está disponible en países piloto (Colombia, Sierra Leona).',
  ],
  gd_verified_city_required: [
    'This course requires a verified city of worship.',
    'Este curso requiere una ciudad de culto verificada.',
  ],
  gd_non_zionist: [
    'This course is restricted to non-Zionists (those who answered no to supporting Israel in the Gaza genocide in the Profile question).',
    'Este curso está restringido a no sionistas (quienes respondieron que no apoyan a Israel en el genocidio de Gaza en la pregunta del Perfil).',
  ],
  auth_required: [
    'Authentication required for premium course',
    'Se requiere autenticación para acceder al curso premium',
  ],
  purchase_required: [
    'Purchase required',
    'Se requiere compra',
  ],
  not_eligible: [
    'Not eligible',
    'No cumples los requisitos',
  ],
  connect_wallet: [
    'Connect your wallet to access this premium course.',
    'Conecta tu billetera para acceder a este curso premium.',
  ],
}

/** Localize a course-access/purchase denial reason key. Unknown keys are
 *  returned as-is so technical messages still surface. */
export function courseAccessReasonText(key: string | null | undefined, lang: string): string {
  if (!key) return ''
  const pair = MESSAGES[key]
  if (!pair) return key
  return lang === 'es' ? pair[1] : pair[0]
}
