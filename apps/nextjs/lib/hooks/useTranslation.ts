import { useMemo } from 'react'

export function useTranslation(lang: string = 'en') {
  const t = useMemo(() => {
    return (en: string, es: string) => (lang === 'es' ? es : en)
  }, [lang])

  return t
}