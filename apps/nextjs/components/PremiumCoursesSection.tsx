'use client'

// "My premium courses" (https://github.com/pasosdeJesus/learn.tg/issues/128 §2.3):
// lists the user's purchases from `GET /api/courses/premium/mine` (date, USDT and
// SLEARN paid, transaction hash) so a purchase is visible in the profile, not only
// on the course page. Premium access does not expire (the criterion "show expiry
// date (if applicable)" is met by there being none), so the row links to the course
// to make that explicit.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { useAuthedApi } from '@/lib/hooks/useAuthedApi'

interface PremiumPurchase {
  course_id: number
  purchased_at: string | null
  usdt_amount_paid: number | string | null
  slearn_amount_paid: number | string | null
  transaction_hash: string | null
  titulo: string | null
  prefijoRuta: string | null
  idioma: string | null
}

const EXPLORER_FALLBACK = 'https://celoscan.io/tx/'

function formatDate(value: string | null, lang: string): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(lang === 'es' ? 'es' : 'en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function PremiumCoursesSection({ lang }: { lang: string }) {
  const es = lang === 'es'
  const { address } = useAuthAddress()
  const { authedGet, ready } = useAuthedApi()
  const [purchases, setPurchases] = useState<PremiumPurchase[]>([])

  useEffect(() => {
    if (!ready || !address) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await authedGet<{ courses: PremiumPurchase[] }>('/api/courses/premium/mine')
        if (!cancelled) {
          setPurchases(Array.isArray(res.data?.courses) ? res.data.courses : [])
        }
      } catch {
        // The rest of the profile must keep working without this list.
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, address])

  if (!address || purchases.length === 0) return null

  const explorer = process.env.NEXT_PUBLIC_EXPLORER_TX || EXPLORER_FALLBACK

  return (
    <div
      data-testid="premium-courses"
      className="mt-6 rounded-xl border border-gray-200 bg-white p-5 text-sm"
    >
      <h3 className="text-base font-semibold text-gray-800 mb-2">
        {es ? 'Mis cursos premium' : 'My premium courses'}
      </h3>
      <ul className="space-y-3">
        {purchases.map((p) => {
          const usdt = Number(p.usdt_amount_paid ?? 0)
          // `slearn_amount_paid` es DECIMAL(10,2) en SLEARN legibles desde la
          // migración 20260921180000 (antes INTEGER en centésimas, y este lector
          // dividía por 100).
          const slearn = Number(p.slearn_amount_paid ?? 0)
          const date = formatDate(p.purchased_at, lang)
          const courseHref = `/${lang}${p.prefijoRuta ?? ''}`
          return (
            <li key={p.course_id} className="border-t border-gray-100 pt-2 first:border-t-0 first:pt-0">
              <Link
                href={courseHref}
                className="font-semibold text-blue-600 underline hover:text-blue-800"
              >
                {p.titulo || `#${p.course_id}`}
              </Link>
              <div className="text-gray-600">
                {date && (
                  <span>
                    {es ? 'Comprado el' : 'Purchased on'} {date}
                  </span>
                )}
                {date && (usdt > 0 || slearn > 0) && <span> · </span>}
                {usdt > 0 && <span>{usdt.toFixed(2)} USDT</span>}
                {usdt > 0 && slearn > 0 && <span> + </span>}
                {slearn > 0 && <span>{slearn.toFixed(2)} SLEARN</span>}
              </div>
              {p.transaction_hash && (
                <a
                  href={`${explorer}${p.transaction_hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 underline hover:text-blue-800"
                >
                  {es ? 'Ver transacción' : 'View transaction'}
                </a>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
