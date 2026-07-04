'use client'

import { use } from 'react'
import { createComponentT } from '@/lib/hooks/useTranslation'

export default function TermsOfServicePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = use(params)
  const t = createComponentT(lang, {
    en: {
      title: 'Terms of Service',
      item1: 'This platform is provided "as is" without warranties of any kind.',
      item2: 'You are responsible for your wallet and all actions performed with it.',
      item3: 'The platform may update these terms at any time. Continued use constitutes acceptance.',
      item4: 'You agree not to use the platform for any unlawful or harmful activity.',
      item5: 'By using this platform, you accept full responsibility for your own decisions and actions.',
    },
    es: {
      title: 'Términos de Servicio',
      item1: 'Esta plataforma se proporciona "tal cual" sin garantías de ningún tipo.',
      item2: 'Eres responsable de tu billetera y de todas las acciones realizadas con ella.',
      item3: 'La plataforma puede actualizar estos términos en cualquier momento. El uso continuo constituye aceptación.',
      item4: 'Aceptas no utilizar la plataforma para ninguna actividad ilegal o dañina.',
      item5: 'Al usar esta plataforma, aceptas la responsabilidad total de tus propias decisiones y acciones.',
    },
  })

  return (
    <div className="bg-gradient-to-br from-white via-gray-50 to-gray-100 py-12 px-6 min-h-screen">
    <div className="max-w-3xl mx-auto">
    <h1 className="text-3xl font-bold text-gray-900 mb-8">{t('title')}</h1>
    <ul className="list-disc list-inside space-y-3 text-gray-700">
    <li>{t('item1')}</li>
    <li>{t('item2')}</li>
    <li>{t('item3')}</li>
    <li>{t('item4')}</li>
    <li>{t('item5')}</li>
    </ul>
    </div>
    </div>
  )
}
