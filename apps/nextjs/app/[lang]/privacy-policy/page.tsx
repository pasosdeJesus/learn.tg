'use client'

import { use } from 'react'
import { createComponentT } from '@/lib/hooks/useTranslation'

export default function PrivacyPolicyPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = use(params)
  const t = createComponentT(lang, {
    en: {
      title: 'Privacy Policy',
      item1: 'We do not sell or share the personal information you provide.',
      item2: 'Your wallet address, username, blockchain transactions, and platform actions (course progress, scholarships received, donations) are public. When you declare a church or join a cluster, church name, city, and pastor name also become publicly visible.',
      item3: 'Your WhatsApp, Telegram, or email is never sold or shared. We use them only to verify your profile information and occasionally to send announcements about platform updates. If you prefer not to receive announcements, do not provide that information.',
      item4: 'ID photos and church registration documents you upload are stored on our servers. Only the Pasos de Jesús team can access them for verification purposes. You can delete them at any time from your profile.',
      item5: 'To remove your personal information from public view, go to your profile page and replace it with non-personal information (any sequence of letters or numbers will work).',
      item6: 'To delete verified data, click the "Delete Verified Data" button on your profile page. This immediately removes all verified fields (WhatsApp, Telegram, location, place of worship) and ID photos, and resets your profile score. This action cannot be undone.',
      item7: 'We cannot remove on-chain transactions or blockchain records — they are permanent and immutable. Internal logs may retain data for security and auditing for up to 90 days.',
    },
    es: {
      title: 'Política de Privacidad',
      item1: 'No vendemos ni compartimos la información personal que proporciones.',
      item2: 'Tu dirección de billetera, nombre de usuario, transacciones en blockchain y acciones en la plataforma (progreso de cursos, becas recibidas, donaciones) son públicos. Cuando declaras una iglesia o te unes a un clúster, el nombre de la iglesia, la ciudad y el nombre del pastor también se vuelven visibles públicamente.',
      item3: 'Tu WhatsApp, Telegram o correo nunca se venden ni se comparten. Los usamos solo para verificar la información de tu perfil y ocasionalmente para enviar anuncios sobre novedades de la plataforma. Si prefieres no recibir anuncios, no suministres esa información.',
      item4: 'Las fotos de identidad y los documentos de registro de iglesia que subes se almacenan en nuestros servidores. Solo el equipo de Pasos de Jesús puede acceder a ellos con fines de verificación. Puedes eliminarlos en cualquier momento desde tu perfil.',
      item5: 'Para eliminar tu información personal de la vista pública, ve a tu página de perfil y reemplázala con información no personal (cualquier secuencia de letras o números funcionará).',
      item6: 'Para eliminar datos verificados, haz clic en el botón "Eliminar Información Verificada" en tu página de perfil. Esto elimina inmediatamente todos los campos verificados (WhatsApp, Telegram, ubicación, lugar de culto) y fotos de identidad, y restablece tu puntaje de perfil. Esta acción no se puede deshacer.',
      item7: 'No podemos eliminar transacciones en blockchain ni registros en la cadena — son permanentes e inmutables. Los registros internos pueden conservar datos por razones de seguridad y auditoría hasta 90 días.',
    },
  })

  return (
    <div className="bg-gradient-to-br from-white via-gray-50 to-gray-100 py-12 px-6">
      <h1>{t('title')}</h1>
      <ul className="list-disc list-inside space-y-2">
        <li>{t('item1')}</li>
        <li>{t('item2')}</li>
        <li>{t('item3')}</li>
        <li>{t('item4')}</li>
        <li>{t('item5')}</li>
        <li>{t('item6')}</li>
        <li>{t('item7')}</li>
      </ul>
    </div>
  )
}
