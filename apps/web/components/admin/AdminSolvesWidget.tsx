'use client'

// Asuntos por resolver (`admin_solves`) en el panel del verificador.
//
// Las rutas que mueven dinero insertan una fila cuando algo falla después de la
// transferencia: el 10% del curso GD que no se pudo registrar en `transaction`
// (`type='gd_cluster_ledger'`, `packages/gdcluster/src/lib/gd-cluster-routing.ts`) y el
// enrutamiento del 10% al fondo del clúster (`type='gd_cluster_transfer'`,
// `packages/rewards/src/routes/check-crossword.ts`). Antes nadie las veía: quedaban en
// la tabla sin que nadie supiera que el ledger estaba incompleto.
// https://github.com/pasosdeJesus/learn.tg/issues/161

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { adminFetch } from '@/lib/admin-fetch'

export interface SolveRow {
  id: string | number
  type: string
  metadata: Record<string, unknown> | null
  created_at: string
  solved_at: string | null
  solved_by: number | null
  solved_by_name?: string | null
  note: string | null
}

export interface SolvesPayload {
  items: SolveRow[]
  counts: { type: string; count: string | number }[]
  pendingTotal: number
  status: string
  type: string | null
}

export function AdminSolvesWidget({ lang }: { lang: string }) {
  const [data, setData] = useState<SolvesPayload | null>(null)
  const [loading, setLoading] = useState(true)

  const t = createComponentT(lang, {
    en: {
      title: 'Issues to resolve',
      none: 'Nothing pending',
      loading: 'Loading...',
      all: 'See all →',
      since: 'since',
    },
    es: {
      title: 'Asuntos por resolver',
      none: 'Nada pendiente',
      loading: 'Cargando...',
      all: 'Ver todos →',
      since: 'desde',
    },
  })

  useEffect(() => {
    let alive = true
    adminFetch<SolvesPayload>('/api/admin/solves?status=pending&limit=5')
      .then(d => { if (alive) { setData(d); setLoading(false) } })
      .catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const total = data?.pendingTotal ?? 0
  return (
    <div className="bg-white rounded-lg border p-4" data-testid="admin-solves-widget">
      <h2 className="font-semibold text-lg mb-3">
        {t('title')} ({total})
      </h2>
      {loading ? <p className="text-gray-500 text-sm">{t('loading')}</p>
        : total === 0 ? <p className="text-gray-500 text-sm">{t('none')}</p>
        : (
          <div className="space-y-2">
            <ul className="space-y-1">
              {(data?.counts || []).map(c => (
                <li key={c.type} className="flex justify-between text-sm">
                  <code className="font-mono text-xs">{c.type}</code>
                  <span className="font-semibold">{Number(c.count)}</span>
                </li>
              ))}
            </ul>
            <div className="border-t pt-2 space-y-1">
              {(data?.items || []).map(item => (
                <div key={String(item.id)} className="text-xs text-gray-600 flex justify-between gap-2">
                  <code className="font-mono">{item.type}</code>
                  <span className="text-gray-400">
                    {t('since')} {new Date(item.created_at).toLocaleDateString(lang === 'es' ? 'es' : 'en')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      <Link href={`/${lang}/admin/solves`} className="mt-3 inline-block text-sm text-blue-600 hover:underline">
        {t('all')}
      </Link>
    </div>
  )
}
