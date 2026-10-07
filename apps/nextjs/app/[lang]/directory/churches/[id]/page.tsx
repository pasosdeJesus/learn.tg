'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import type { DirectoryEntry } from '@/lib/church-directory'

type PageProps = { params: Promise<{ lang: string; id: string }> }

export default function ChurchDetailPage({ params }: PageProps) {
  const { lang, id } = use(params)
  const { address } = useAuthAddress()
  const [church, setChurch] = useState<DirectoryEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [claimMsg, setClaimMsg] = useState('')

  const t = createComponentT(lang, {
    en: {
      loading: 'Loading...', notFound: 'Church not found.',
      reputation: 'Reputation', activity: 'Activity', members: 'Members', denomination: 'Denomination',
      country: 'Country', city: 'City', pastor: 'Pastor', back: '← Church directory',
      claim: 'Claim this church', claimed: 'Your claim was recorded; a verifier will contact you.',
      notRecommended: 'This church is not recommended by the platform (unresolved dispute).',
      loginToClaim: 'Sign in to claim this church.',
    },
    es: {
      loading: 'Cargando...', notFound: 'Iglesia no encontrada.',
      reputation: 'Reputación', activity: 'Actividad', members: 'Miembros', denomination: 'Denominación',
      country: 'País', city: 'Ciudad', pastor: 'Pastor', back: '← Directorio de iglesias',
      claim: 'Reclamar esta iglesia', claimed: 'Tu reclamación quedó registrada; un verificador te contactará.',
      notRecommended: 'Esta iglesia no es recomendada por la plataforma (disputa no resuelta).',
      loginToClaim: 'Inicia sesión para reclamar esta iglesia.',
    },
  })

  useEffect(() => {
    fetch(`/api/directory/churches/${id}`)
      .then(async (r) => {
        if (r.status === 404 || !r.ok) { setMissing(true); setLoading(false); return }
        const d = await r.json()
        setChurch(d.church)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  const claim = async () => {
    if (!address) return
    const res = await fetch(`/api/directory/churches/${id}/claim?walletAddress=${encodeURIComponent(address)}`, { method: 'POST' })
    if (res.ok) setClaimMsg(t('claimed'))
  }

  if (loading) return <div className="container mx-auto py-8 px-4"><p className="text-gray-500">{t('loading')}</p></div>
  if (missing || !church) return <div className="container mx-auto py-8 px-4"><p className="text-gray-500">{t('notFound')}</p></div>

  const isNotRecommended = church.activityScore == null && church.reputationScore === 0

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <Link href={`/${lang}/directory/churches`} className="text-sm text-blue-600 hover:underline">{t('back')}</Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">{church.name}</h1>
      <p className="text-sm text-gray-500 mb-4">
        {[church.denomination, church.cityName, church.countryName].filter(Boolean).join(' · ')}
      </p>

      {isNotRecommended && <p className="text-amber-700 text-sm mb-4">{t('notRecommended')}</p>}

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-gray-500">{t('reputation')}</dt><dd>{church.reputationScore}</dd>
        <dt className="text-gray-500">{t('activity')}</dt><dd>{church.activityScore ?? '—'}</dd>
        <dt className="text-gray-500">{t('members')}</dt><dd>{church.amountMember ?? '—'}</dd>
        <dt className="text-gray-500">{t('pastor')}</dt>
        <dd>{church.pastorId ? <Link href={`/${lang}/user/${church.pastorId}`} className="text-blue-600 hover:underline">{church.pastorName || `#${church.pastorId}`}</Link> : '—'}</dd>
      </dl>

      <div className="mt-6">
        {address ? (
          <button onClick={claim} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">{t('claim')}</button>
        ) : (
          <p className="text-xs text-gray-500">{t('loginToClaim')}</p>
        )}
        {claimMsg && <p className="text-green-700 text-xs mt-2">{claimMsg}</p>}
      </div>
    </div>
  )
}
