'use client'

import { useEffect, useState } from 'react'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { adminFetch } from '@/lib/admin-fetch'

// Contabilidad comercial de los cursos de pago. Vivía en el panel público de
// transparencia y se movió aquí el 2026-09-21 (decisión del operador): la
// transparencia sirve a la confianza en SLEARN (reservas y flujos del token), y el
// detalle por curso en USDT/SLEARN es información interna. Solo verificadores:
// `GET /api/admin/premium-purchases` exige `authenticateAdmin`.
// Ver https://github.com/pasosdeJesus/learn.tg/issues/128.

interface CourseRow {
  courseId: number
  titulo: string | null
  purchases: number
  usdt: number
  slearn: number
}

interface Payload {
  courses: CourseRow[]
  totals: { purchases: number; usdt: number; slearn: number }
}

export function PremiumPurchasesWidget({ lang }: { lang: string }) {
  const t = createComponentT(lang, {
    en: {
      title: 'Premium purchases',
      course: 'Course',
      purchases: 'Purchases',
      usdt: 'USDT',
      slearn: 'SLEARN',
      total: 'Total',
      none: 'No purchases yet',
      loading: 'Loading...',
    },
    es: {
      title: 'Compras premium',
      course: 'Curso',
      purchases: 'Compras',
      usdt: 'USDT',
      slearn: 'SLEARN',
      total: 'Total',
      none: 'Aún no hay compras',
      loading: 'Cargando...',
    },
  })

  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminFetch<Payload>('/api/admin/premium-purchases')
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="bg-white rounded-lg border p-4" data-testid="premium-purchases">
      <h2 className="font-semibold text-lg mb-3">💳 {t('title')}</h2>
      {loading ? (
        <p className="text-gray-500 text-sm">{t('loading')}</p>
      ) : !data || data.courses.length === 0 ? (
        <p className="text-gray-500 text-sm">{t('none')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-gray-400">
                <th className="py-1">{t('course')}</th>
                <th className="py-1 text-right">{t('purchases')}</th>
                <th className="py-1 text-right">{t('usdt')}</th>
                <th className="py-1 text-right">{t('slearn')}</th>
              </tr>
            </thead>
            <tbody>
              {data.courses.map((c) => (
                <tr key={c.courseId} className="border-t border-gray-100">
                  <td className="py-1">{c.titulo || `#${c.courseId}`}</td>
                  <td className="py-1 text-right">{c.purchases}</td>
                  <td className="py-1 text-right">{c.usdt.toFixed(2)}</td>
                  <td className="py-1 text-right">{c.slearn.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t font-semibold">
                <td className="py-1">{t('total')}</td>
                <td className="py-1 text-right">{data.totals.purchases}</td>
                <td className="py-1 text-right">{data.totals.usdt.toFixed(2)}</td>
                <td className="py-1 text-right">{data.totals.slearn.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
