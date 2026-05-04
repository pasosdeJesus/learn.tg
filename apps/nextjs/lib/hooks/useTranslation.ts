import { useMemo } from 'react'
import { createTranslator } from '@pasosdejesus/m/i18n'
import commonTranslations from '@/lib/i18n/common'

/**
 * Hook for bilingual (en/es) translations with common fallback.
 * Built on `createTranslator` from @pasosdejesus/m/i18n.
 *
 * Usage: const t = useTranslation(lang)
 *        t('English text', 'Spanish text')
 */
export function useTranslation(lang: string = 'en') {
  const t = useMemo(() => {
    return (en: string, es: string) => lang === 'es' ? es : en
  }, [lang])

  return t
}

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
