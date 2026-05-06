'use client'

import { use } from 'react'
import { createComponentT } from '@/lib/hooks/useTranslation'

export default function PrivacyPolicyPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = use(params)
  const t = createComponentT(lang, {
    en: {
      title: 'Privacy Policy',
      item1: 'We will not sell neither share the personal information you provide.',
      item2: 'Your wallet address, your login name, your blockchain transactions and your actions in the platform are considered public. The rest of the information in your profile is private and we will not present it to the public.',
      item3: 'To remove your personal information as presented by this app, please go to the profile page and fill the fields with non-personal information (any sequence of letters or numbers will work).',
      item4: 'We cannot remove from our internal records neither from logs your onchain transaction neither your personal information.',
    },
    es: {
      title: 'Política de Privacidad',
      item1: 'No venderemos ni compartiremos la información personal que proporciones.',
      item2: 'Tu dirección de billetera, tu nombre de usuario, tus transacciones en la blockchain y tus acciones en la plataforma se consideran públicos. El resto de la información en tu perfil es privada y no la presentaremos al público.',
      item3: 'Para eliminar tu información personal presentada en esta aplicación, ve a la página de perfil y llena los campos con información no personal (cualquier secuencia de letras o números funcionará).',
      item4: 'No podemos eliminar de nuestros registros internos ni de los registros tu transacción en la blockchain ni tu información personal.',
    },
  })

  return (
    <div className="bg-gradient-to-br from-white via-gray-50 to-gray-100 py-12 px-6">
      <h1>{t('title')}</h1>
      <ul>
        <li>{t('item1')}</li>
        <li>{t('item2')}</li>
        <li>{t('item3')}</li>
        <li>{t('item4')}</li>
      </ul>
    </div>
  )
}
