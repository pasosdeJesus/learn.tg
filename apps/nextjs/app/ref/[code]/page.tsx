import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

// Redirect de /ref/{CODE} (legacy) a /[lang]/ref/{CODE} según el idioma del
// navegador — mantiene la lógica i18n consistente (/en/ref, /es/ref) y los
// enlaces antiguos compartidos siguen funcionando.
export default async function RefLegacyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const accept = (await headers()).get('accept-language') || ''
  const lang = accept.toLowerCase().startsWith('es') ? 'es' : 'en'
  redirect(`/${lang}/ref/${code}`)
}
