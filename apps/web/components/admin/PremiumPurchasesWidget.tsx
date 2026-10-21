'use client'

import { useEffect, useState } from 'react'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { adminFetch } from '@/lib/admin-fetch'
import { Modal } from './Modal'

// Contabilidad comercial de los cursos de pago. Vivía en el panel público de
// transparencia y se movió aquí el 2026-09-21 (decisión del operador): la
// transparencia sirve a la confianza en SLEARN (reservas y flujos del token), y el
// detalle por curso en USDT/SLEARN es información interna. Solo verificadores:
// `GET /api/admin/premium-purchases` exige `authenticateAdmin`.
// Ver https://github.com/pasosdeJesus/learn.tg/issues/128.
//
// Cada curso abre la lista de personas **inscritas** (quienes compraron el curso),
// servida por `GET /api/admin/premium-purchases/[courseId]` (también admin-only).

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

interface StudentRow {
  id: number
  nusuario: string | null
  nombre: string | null
  email: string | null
  profilescore: number | null
  billetera: string | null
  pais_nombre: string | null
  usdt_amount_paid: number | string | null
  slearn_amount_paid: number | string | null
  transaction_hash: string | null
  purchased_at: string | null
}

type TFunc = (k: string) => string

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
      viewEnrolled: 'View enrolled',
      enrolledTitle: 'Enrolled in {course}',
      enrolledNone: 'No one has purchased this course yet.',
      student: 'Student',
      wallet: 'Wallet',
      country: 'Country',
      score: 'Score',
      date: 'Date',
      close: 'Close',
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
      viewEnrolled: 'Ver inscritos',
      enrolledTitle: 'Inscritos en {course}',
      enrolledNone: 'Nadie ha comprado este curso todavía.',
      student: 'Estudiante',
      wallet: 'Billetera',
      country: 'País',
      score: 'Puntaje',
      date: 'Fecha',
      close: 'Cerrar',
    },
  })

  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CourseRow | null>(null)

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
                <tr key={c.courseId} className="border-t border-gray-100 group">
                  <td className="py-1">
                    <button
                      type="button"
                      data-testid={`view-enrolled-${c.courseId}`}
                      onClick={() => setSelected(c)}
                      className="text-left text-blue-600 hover:underline"
                      title={t('viewEnrolled')}
                    >
                      {c.titulo || `#${c.courseId}`}
                    </button>
                  </td>
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

      {selected && (
        <EnrolledModal course={selected} lang={lang} t={t} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

function EnrolledModal({ course, lang, t, onClose }: { course: CourseRow; lang: string; t: TFunc; onClose: () => void }) {
  const [students, setStudents] = useState<StudentRow[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    adminFetch<{ students?: StudentRow[] }>(`/api/admin/premium-purchases/${course.courseId}`)
      .then((d) => setStudents(d.students || []))
      .catch((e) => { setError(e?.message || String(e)); setStudents([]) })
  }, [course.courseId])

  const title = t('enrolledTitle').replace('{course}', course.titulo || `#${course.courseId}`)
  const fmtAmount = (v: number | string | null) => {
    const n = Number(v || 0)
    return n ? n.toFixed(2) : '—'
  }
  const fmtDate = (v: string | null) => {
    if (!v) return '—'
    const d = new Date(v)
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(lang === 'es' ? 'es' : 'en', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  return (
    <Modal title={title} onClose={onClose}>
      {students === null ? (
        <p className="text-gray-500 text-sm">{t('loading')}</p>
      ) : error ? (
        <p className="text-red-600 text-sm">{error}</p>
      ) : students.length === 0 ? (
        <p className="text-gray-500 text-sm">{t('enrolledNone')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="enrolled-list">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-gray-400">
                <th className="py-1">{t('student')}</th>
                <th className="py-1 hidden sm:table-cell">{t('wallet')}</th>
                <th className="py-1 hidden md:table-cell">{t('country')}</th>
                <th className="py-1 text-right">{t('usdt')}</th>
                <th className="py-1 text-right">{t('slearn')}</th>
                <th className="py-1 text-right">{t('date')}</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-t border-gray-100">
                  <td className="py-1">
                    <div className="font-medium">{s.nombre || s.nusuario || `#${s.id}`}</div>
                    {s.email && <div className="text-xs text-gray-400">{s.email}</div>}
                  </td>
                  <td className="py-1 hidden sm:table-cell">
                    <span className="font-mono text-xs text-gray-500">
                      {s.billetera ? `${s.billetera.slice(0, 6)}...${s.billetera.slice(-4)}` : '—'}
                    </span>
                  </td>
                  <td className="py-1 hidden md:table-cell text-xs">{s.pais_nombre || '—'}</td>
                  <td className="py-1 text-right">{fmtAmount(s.usdt_amount_paid)}</td>
                  <td className="py-1 text-right">{fmtAmount(s.slearn_amount_paid)}</td>
                  <td className="py-1 text-right text-xs text-gray-500">{fmtDate(s.purchased_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}
