import { createTranslator } from '@pasosdejesus/m/i18n'
import commonTranslations from '@/lib/i18n/common'

/**
 * Creates a keyed translator for a component with local translations.
 * Automatically falls back to common translations (@pasosdejesus/m/i18n pattern).
 *
 * Usage:
 *   const localT = {
 *     en: { hello: 'Hello' },
 *     es: { hello: 'Hola' },
 *   }
 *   const t = createComponentT(lang, localT)
 *   t('hello')
 */
export function createComponentT(
  lang: string,
  translations: Parameters<typeof createTranslator>[1]
) {
  return createTranslator(lang, translations, commonTranslations)
}
