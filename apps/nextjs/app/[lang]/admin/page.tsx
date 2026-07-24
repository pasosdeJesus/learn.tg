'use client'

import { use, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { createComponentT } from '@/lib/hooks/useTranslation'

type PageProps = { params: Promise<{ lang: string }> }
const VERIFIER_WALLETS = (process.env.NEXT_PUBLIC_VERIFIER_WALLET || '')
  .split(',')
  .map(w => w.trim().toLowerCase())
  .filter(Boolean)

export default function AdminDashboard({ params }: PageProps) {
  const { lang } = use(params)
  const { address } = useAuthAddress()

  const t = createComponentT(lang, {
    en: { title: 'Verification Dashboard', accessDenied: 'Access denied. Verifier wallet required.', loading: 'Loading...',
      recentUsers: 'Recent Users', recentChurches: 'Recent Churches', viewAll: 'View all',
      pendingVerifications: 'Pending Verifications', calendar: 'My Calendar', notConfigured: 'NEXT_PUBLIC_VERIFIER_WALLET not set' },
    es: { title: 'Panel de Verificación', accessDenied: 'Acceso denegado. Se requiere billetera de verificador.', loading: 'Cargando...',
      recentUsers: 'Usuarios Recientes', recentChurches: 'Iglesias Recientes', viewAll: 'Ver todos',
      pendingVerifications: 'Verificaciones Pendientes', calendar: 'Mi Calendario', notConfigured: 'NEXT_PUBLIC_VERIFIER_WALLET no configurado' },
  })

  if (VERIFIER_WALLETS.length === 0) {
    return <div className="container mx-auto py-16 px-4 text-center"><p className="text-amber-600">{t('notConfigured')}</p></div>
  }

  if (!address || !VERIFIER_WALLETS.includes(address.toLowerCase())) {
    return <div className="container mx-auto py-16 px-4 text-center"><p className="text-red-600 font-medium">{t('accessDenied')}</p></div>
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Widget title={t('calendar')} lang={lang} endpoint="/api/admin/calendar/events" field="events" emptyMsg="Sin eventos" />
          <Widget title={t('pendingVerifications')} lang={lang} endpoint="/api/admin/users?status=pending" field="users" emptyMsg="Sin pendientes" />
        </div>
        <div className="space-y-6">
          <Widget title={t('recentUsers')} lang={lang} endpoint="/api/admin/users/recent" field="users" emptyMsg="Sin usuarios" />
          <Widget title={t('recentChurches')} lang={lang} endpoint="/api/admin/churches/recent" field="churches" emptyMsg="Sin iglesias" />
        </div>
      </div>
    </div>
  )
}

function Widget({ title, lang, endpoint, field, emptyMsg }: { title: string; lang: string; endpoint: string; field: string; emptyMsg: string }) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(endpoint).then(r => r.json()).then(d => { setItems(d[field] || []); setLoading(false) }).catch(() => setLoading(false))
  }, [endpoint, field])

  return (
    <div className="bg-white rounded-lg border p-4">
      <h2 className="font-semibold text-lg mb-3">{title}</h2>
      {loading ? <p className="text-gray-500 text-sm">{lang === 'es' ? 'Cargando...' : 'Loading...'}</p>
        : items.length === 0 ? <p className="text-gray-500 text-sm">{emptyMsg}</p>
        : <div className="space-y-2 max-h-64 overflow-y-auto">
          {items.map((item: any, i: number) => (
            <div key={item.id || i} className="border-b pb-2 text-sm">{JSON.stringify(item).slice(0, 120)}</div>
          ))}
        </div>}
    </div>
  )
}
