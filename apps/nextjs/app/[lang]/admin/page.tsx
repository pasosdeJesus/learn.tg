'use client'

import { use, useState } from 'react'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { CalendarWidget } from '@/components/admin/CalendarWidget'
import { PendingWidget, RecentUsersWidget, RecentChurchesWidget } from '@/components/admin/AdminWidgets'
import Link from 'next/link'

type PageProps = { params: Promise<{ lang: string }> }
const VERIFIER_WALLETS = (process.env.NEXT_PUBLIC_VERIFIER_WALLET || '')
  .split(',')
  .map(w => w.trim().toLowerCase())
  .filter(Boolean)

export default function AdminDashboard({ params }: PageProps) {
  const { lang } = use(params)
  const { address } = useAuthAddress()
  const [churchKey, setChurchKey] = useState(0)
  const bumpChurches = () => setChurchKey(k => k + 1)

  const t = createComponentT(lang, {
    en: {
      title: 'Verification Dashboard', accessDenied: 'Access denied. Verifier wallet required.',
      loading: 'Loading...', recentUsers: 'Recent Users', recentChurches: 'Recent Churches',
      pendingVerifications: 'Pending Verifications', calendar: 'My Calendar',
      allUsers: 'All Users →', allChurches: 'All Churches →',
      notConfigured: 'NEXT_PUBLIC_VERIFIER_WALLET not set',
      noEvents: 'No events', noPending: 'No pending verifications',
      noUsers: 'No users', noChurches: 'No churches',
      blockTime: 'Block Time', addBlock: 'Add Block',
      interview: 'Interview', blocked: 'Blocked',
      wallet: 'Wallet', name: 'Name', country: 'Country',
      score: 'Score', role: 'Role', date: 'Date',
      pastor: 'Pastor', city: 'Ciudad', denomination: 'Denomination',
      proposed: 'Proposed', editUser: 'Edit User', editChurch: 'Edit Church',
      save: 'Save', cancel: 'Cancel', delete: 'Delete',
      saveSuccess: 'Saved', deleteConfirm: 'Delete this church?',
      verifiedFields: 'Verified Fields', profileFields: 'Profile Fields',
    },
    es: {
      title: 'Panel de Verificación', accessDenied: 'Acceso denegado. Se requiere billetera de verificador.',
      loading: 'Cargando...', recentUsers: 'Usuarios Recientes', recentChurches: 'Iglesias Recientes',
      pendingVerifications: 'Verificaciones Pendientes', calendar: 'Mi Calendario',
      allUsers: 'Todos los Usuarios →', allChurches: 'Todas las Iglesias →',
      notConfigured: 'NEXT_PUBLIC_VERIFIER_WALLET no configurado',
      noEvents: 'Sin eventos', noPending: 'Sin verificaciones pendientes',
      noUsers: 'Sin usuarios', noChurches: 'Sin iglesias',
      blockTime: 'Bloquear Horario', addBlock: 'Agregar Bloqueo',
      interview: 'Entrevista', blocked: 'Bloqueado',
      wallet: 'Billetera', name: 'Nombre', country: 'País',
      score: 'Puntaje', role: 'Rol', date: 'Fecha',
      pastor: 'Pastor', city: 'Ciudad', denomination: 'Denominación',
      proposed: 'Propuesta', editUser: 'Editar Usuario', editChurch: 'Editar Iglesia',
      save: 'Guardar', cancel: 'Cancelar', delete: 'Eliminar',
      saveSuccess: 'Guardado', deleteConfirm: '¿Eliminar esta iglesia?',
      verifiedFields: 'Campos Verificados', profileFields: 'Campos de Perfil',
    },
  })

  if (VERIFIER_WALLETS.length === 0) {
    return <div className="container mx-auto py-16 px-4 text-center"><p className="text-amber-600">{t('notConfigured')}</p></div>
  }
  if (!address || !VERIFIER_WALLETS.includes(address.toLowerCase())) {
    return <div className="container mx-auto py-16 px-4 text-center"><p className="text-red-600 font-medium">{t('accessDenied')}</p></div>
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <h1 className="text-2xl font-bold mb-6">🛡️ {t('title')}</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <CalendarWidget lang={lang} t={t} />
          <PendingWidget lang={lang} t={t} onUserModalClose={bumpChurches} />
        </div>
        <div className="space-y-6">
          <RecentUsersWidget lang={lang} t={t} onUserModalClose={bumpChurches} />
          <RecentChurchesWidget lang={lang} t={t} key={churchKey} />
        </div>
      </div>
      <div className="mt-6 flex gap-4">
        <Link href={`/${lang}/admin/users`} className="text-sm text-blue-600 hover:underline">
          👥 {t('allUsers')}
        </Link>
        <Link href={`/${lang}/admin/churches`} className="text-sm text-blue-600 hover:underline">
          🏛️ {t('allChurches')}
        </Link>
      </div>
    </div>
  )
}
