'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { createComponentT } from '@/lib/hooks/useTranslation'

type PageProps = {
  params: Promise<{
    lang: string
    id: string
  }>
}

const tEn = {
  back: 'Back to home',
  pastor: 'Pastor: ',
  cluster: 'Cluster',
  churches: 'Churches',
  formed: 'Formed',
  inProgress: 'In Progress',
  noCluster: 'This church does not belong to a cluster yet.',
  created: 'Created',
  churchNotFound: 'Church not found',
}
const tEs: typeof tEn = {
  back: 'Volver al inicio',
  pastor: 'Pastor: ',
  cluster: 'Clúster',
  churches: 'Iglesias',
  formed: 'Formado',
  inProgress: 'En Progreso',
  noCluster: 'Esta iglesia aún no pertenece a un clúster.',
  created: 'Creada',
  churchNotFound: 'Iglesia no encontrada',
}
const translations = { en: tEn, es: tEs }

interface ChurchData {
  id: number
  name: string
  country_id: number
  city: string | null
  pastor_name: string | null
  cluster_wallet: string | null
  created_at: string
  cluster: {
    id: number
    name: string
    code: string
    country_id: number
    member_count: number
    status: string
  } | null
}

export default function ChurchPage({ params }: PageProps) {
  const { lang, id } = use(params)
  const t = createComponentT(lang, translations)
  const [church, setChurch] = useState<ChurchData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/church/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(t('churchNotFound'))
        return r.json()
      })
      .then((data) => setChurch(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error || !church) {
    return (
      <div className="max-w-2xl mx-auto p-6 mt-12">
        <p className="text-red-600">{error || t('churchNotFound')}</p>
        <Link href={`/${lang}`} className="text-blue-600 hover:underline mt-4 inline-block">
          ← {t('back')}
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6 mt-12">
      <Link href={`/${lang}`} className="text-blue-600 hover:underline text-sm mb-6 inline-block">
        ← {t('back')}
      </Link>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{church.name}</h1>
        {church.city && (
          <p className="text-gray-500 mb-4">{church.city}</p>
        )}

        {church.pastor_name && (
          <p className="text-sm text-gray-600 mb-1">
            {t('pastor')}{church.pastor_name}
          </p>
        )}

        {church.cluster_wallet && (
          <p className="text-sm text-gray-500 mb-4 font-mono break-all">
            {church.cluster_wallet}
          </p>
        )}

        {church.cluster ? (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              {t('cluster')}
            </h2>
            <Link
              href={`/${lang}/cluster/${church.cluster.id}`}
              className="text-blue-600 hover:underline font-medium"
            >
              {church.cluster.name}
            </Link>
            <p className="text-sm text-gray-600 mt-1">
              {t('churches')}: {church.cluster.member_count}
              {' · '}
              {church.cluster.status === 'Formed' ? t('formed') : t('inProgress')}
            </p>
          </div>
        ) : (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-600 text-sm">
              {t('noCluster')}
            </p>
          </div>
        )}

        <p className="text-xs text-gray-400 mt-6">
          {t('created')}: {new Date(church.created_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  )
}
