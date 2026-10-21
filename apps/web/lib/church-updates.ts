// Columnas NOT NULL de `church` editables por el admin (https://github.com/pasosdeJesus/learn.tg/issues/229). Ver
// `lib/safe-updates.ts` para la regla (un campo vacío en NOT NULL se conserva,
// no se envía como null).

import { buildSafeUpdates } from './safe-updates'

export const CHURCH_NOT_NULL_FIELDS = new Set([
  'name', 'country_id', 'pastor_name', 'pastor_whatsapp',
])

export function buildChurchUpdates(
  body: Record<string, any>,
  allowed: string[],
): Record<string, any> {
  return buildSafeUpdates(body, allowed, CHURCH_NOT_NULL_FIELDS)
}
