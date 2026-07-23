'use client'

import { use, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { Button } from '@/components/ui/button'

const VERIFIER_WALLET = process.env.NEXT_PUBLIC_VERIFIER_WALLET || ''

type PageProps = {
  params: Promise<{ lang: string }>
}

export default function AdminDashboard({ params }: PageProps) {
  const { lang } = use(params)
  const { address } = useAuthAddress()
  const { data: session } = useSession()

  const t = createComponentT(lang, {
    en: {
      title: 'Verification Dashboard',
      accessDenied: 'Access denied. Verifier wallet required.',
      loading: 'Loading...',
      recentUsers: 'Recent Users',
      recentChurches: 'Recent Churches',
      viewAll: 'View all →',
      pendingVerifications: 'Pending Verifications',
      calendar: 'My Calendar',
    },
    es: {
      title: 'Panel de Verificación',
      accessDenied: 'Acceso denegado. Se requiere billetera de verificador.',
      loading: 'Cargando...',
      recentUsers: 'Usuarios Recientes',
      recentChurches: 'Iglesias Recientes',
      viewAll: 'Ver todos →',
      pendingVerifications: 'Verificaciones Pendientes',
      calendar: 'Mi Calendario',
    },
  })

  if (!address || !VERIFIER_WALLET || address.toLowerCase() !== VERIFIER_WALLET.toLowerCase()) {
    return (
      <div className="container mx-auto py-16 px-4 text-center">
        <p className="text-red-600 font-medium">{t('accessDenied')}</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <AdminCalendar lang={lang} />
          <PendingVerifications lang={lang} />
        </div>
        <div className="space-y-6">
          <RecentUsers lang={lang} />
          <RecentChurches lang={lang} />
        </div>
      </div>
    </div>
  )
}

// ─── AdminCalendar ──────────────────────────────────────────

function AdminCalendar({ lang }: { lang: string }) {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const t = createComponentT(lang, {
    en: { title: 'My Calendar', noEvents: 'No upcoming events.', blocked: 'Blocked' },
    es: { title: 'Mi Calendario', noEvents: 'Sin eventos próximos.', blocked: 'Bloqueado' },
  })

  useEffect(() => {
    fetch('/api/admin/calendar/events')
      .then(r => r.json())
      .then(data => { setEvents(data.events || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="bg-white rounded-lg border p-4">
      <h2 className="font-semibold text-lg mb-3">{t('title')}</h2>
      {loading ? (
        <p className="text-gray-500 text-sm">{t('loading')}</p>
      ) : events.length === 0 ? (
        <p className="text-gray-500 text-sm">{t('noEvents')}</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {events.map((e: any) => (
            <div key={e.uid} className="flex justify-between items-start border-b pb-2">
              <div>
                <p className="text-sm font-medium">{e.summary || t('blocked')}</p>
                <p className="text-xs text-gray-500">
                  {new Date(e.start).toLocaleDateString(lang === 'es' ? 'es' : 'en', { weekday: 'short', month: 'short', day: 'numeric' })}
                  {' '}
                  {new Date(e.start).toLocaleTimeString(lang === 'es' ? 'es' : 'en', { hour: '2-digit', minute: '2-digit' })}
                  {' – '}
                  {new Date(e.end).toLocaleTimeString(lang === 'es' ? 'es' : 'en', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── PendingVerifications ───────────────────────────────────

function PendingVerifications({ lang }: { lang: string }) {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const t = createComponentT(lang, {
    en: { title: 'Pending Verifications', empty: 'No pending verifications.' },
    es: { title: 'Verificaciones Pendientes', empty: 'Sin verificaciones pendientes.' },
  })

  useEffect(() => {
    fetch('/api/admin/users?status=pending')
      .then(r => r.json())
      .then(data => { setUsers(data.users || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="bg-white rounded-lg border p-4">
      <h2 className="font-semibold text-lg mb-3">{t('title')}</h2>
      {loading ? (
        <p className="text-gray-500 text-sm">{t('loading')}</p>
      ) : users.length === 0 ? (
        <p className="text-gray-500 text-sm">{t('empty')}</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {users.map((u: any) => (
            <div key={u.id} className="flex justify-between items-center border-b pb-2">
              <div>
                <p className="text-sm font-medium">{u.nombre || u.nusuario}</p>
                <p className="text-xs text-gray-500">{u.billetera?.slice(0, 10)}...</p>
              </div>
              <a href={`/${lang}/admin/user/${u.id}`} className="text-xs text-blue-600 hover:underline">
                {lang === 'es' ? 'Verificar' : 'Verify'}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── RecentUsers ────────────────────────────────────────────

function RecentUsers({ lang }: { lang: string }) {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const t = createComponentT(lang, {
    en: { title: 'Recent Users', empty: 'No users found.' },
    es: { title: 'Usuarios Recientes', empty: 'Sin usuarios.' },
  })

  useEffect(() => {
    fetch('/api/admin/users/recent')
      .then(r => r.json())
      .then(data => { setUsers(data.users || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="bg-white rounded-lg border p-4">
      <h2 className="font-semibold text-lg mb-3">{t('title')}</h2>
      {loading ? (
        <p className="text-gray-500 text-sm">{t('loading')}</p>
      ) : users.length === 0 ? (
        <p className="text-gray-500 text-sm">{t('empty')}</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {users.map((u: any) => (
            <div key={u.id} className="flex justify-between items-start border-b pb-2">
              <div>
                <p className="text-sm font-medium">{u.nombre || u.nusuario}</p>
                <p className="text-xs text-gray-500">{u.email || u.billetera?.slice(0, 10)}...</p>
                <p className="text-xs text-gray-400">{u.pais_nombre || ''}</p>
              </div>
              <a href={`/${lang}/admin/user/${u.id}`} className="text-xs text-blue-600 hover:underline">
                {lang === 'es' ? 'Ver' : 'View'}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── RecentChurches ─────────────────────────────────────────

function RecentChurches({ lang }: { lang: string }) {
  const [churches, setChurches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const t = createComponentT(lang, {
    en: { title: 'Recent Churches', empty: 'No churches found.' },
    es: { title: 'Iglesias Recientes', empty: 'Sin iglesias.' },
  })

  useEffect(() => {
    fetch('/api/admin/churches/recent')
      .then(r => r.json())
      .then(data => { setChurches(data.churches || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="bg-white rounded-lg border p-4">
      <h2 className="font-semibold text-lg mb-3">{t('title')}</h2>
      {loading ? (
        <p className="text-gray-500 text-sm">{t('loading')}</p>
      ) : churches.length === 0 ? (
        <p className="text-gray-500 text-sm">{t('empty')}</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {churches.map((ch: any) => (
            <div key={ch.id} className="flex justify-between items-start border-b pb-2">
              <div>
                <p className="text-sm font-medium">{ch.name}</p>
                <p className="text-xs text-gray-500">{ch.pastor_name}</p>
                <p className="text-xs text-gray-400">{ch.city_name || ch.country_name || ''}</p>
              </div>
              <a href={`/${lang}/admin/church/${ch.id}`} className="text-xs text-blue-600 hover:underline">
                {lang === 'es' ? 'Ver' : 'View'}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
