'use client'

import { use } from 'react'
import { createComponentT } from '@/lib/hooks/useTranslation'

export default function PrivacyPolicyPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = use(params)
  const t = createComponentT(lang, {
    en: {
      title: 'Privacy Policy',
      item1: 'We do not sell or share the personal information you provide.',
      item2: 'Your wallet address, username, blockchain transactions, and learning actions (course progress, scholarships received, donations) are public.',
      item3: 'The other information you provide (like your name, WhatsApp, email, etc.) is considered private and is not sold or shared. We use it only to verify your profile information and occasionally to send announcements about platform updates. If you prefer not to receive announcements, do not provide that information.',
      item4: 'You can access, rectify, and delete your personal data at any time from your profile page. To delete verified data, click the "Delete Verified Data" button. This immediately removes all verified fields (WhatsApp, Telegram, location, place of worship) and ID photos, and resets your profile score. This action cannot be undone.',
      item5: 'We cannot remove on-chain transactions or blockchain records — they are permanent and immutable. Internal logs without personal information are kept for debugging and security auditing, typically for the last 30 days.',
      cookies: 'This site uses a single session cookie (HTTP-only) required to keep your wallet connected. No tracking or analytics cookies are used.',
      responsible: 'Responsible: Pasos de Jesús. Contact: Vladimir Támara Patiño — vtamara@pasosdeJesus.org',
    },
    es: {
      title: 'Política de Privacidad',
      item1: 'No vendemos ni compartimos la información personal que proporciones.',
      item2: 'Tu dirección de billetera, nombre de usuario, transacciones en blockchain y acciones de aprendizaje (progreso de cursos, becas recibidas, donaciones) son públicos.',
      item3: 'La demás información que proporcionas (como tu nombre, WhatsApp, correo, etc.) se considera privada y no se vende ni se comparte. La usamos solo para verificar la información de tu perfil y ocasionalmente para enviar anuncios sobre novedades de la plataforma. Si prefieres no recibir anuncios, no suministres esa información.',
      item4: 'Puedes acceder, rectificar y suprimir tus datos personales en cualquier momento desde tu página de perfil. Para eliminar datos verificados, haz clic en "Eliminar Información Verificada". Esto elimina inmediatamente todos los campos verificados (WhatsApp, Telegram, ubicación, lugar de culto) y fotos de identidad, y restablece tu puntaje de perfil. Esta acción no se puede deshacer.',
      item5: 'No podemos eliminar transacciones en blockchain ni registros en la cadena — son permanentes e inmutables. Los registros internos sin información personal se conservan para depuración y auditoría de seguridad, típicamente de los últimos 30 días.',
      cookies: 'Este sitio usa una única cookie de sesión (HTTP-only) necesaria para mantener tu billetera conectada. No se usan cookies de rastreo ni analíticas.',
      responsible: 'Responsable: Pasos de Jesús. Contacto: Vladimir Támara Patiño — vtamara@pasosdeJesus.org',
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
      </ul>
      <p className="mt-4 text-sm text-gray-500">{t('cookies')}</p>
      <p className="mt-6 text-sm text-gray-500">{t('responsible')}</p>
    </div>
  )
}
