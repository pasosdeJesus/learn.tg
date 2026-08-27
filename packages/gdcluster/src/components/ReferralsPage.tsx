'use client'

import { useEffect, useState } from 'react'
import { use } from 'react'
import Link from 'next/link'
import axios from 'axios'

type PageProps = {
  params: Promise<{ lang: string }>
}

export default function ReferralsPage({ params }: PageProps) {
  const { lang } = use(params)
  const es = lang === 'es'

  const [fund, setFund] = useState<{ slearnBalance: string | null; usdtBalance: string | null } | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await axios.get('/api/referrals/fund')
        if (cancelled) return
        setFund({
          slearnBalance: res.data?.slearnBalance ?? null,
          usdtBalance: res.data?.usdtBalance ?? null,
        })
      } catch {
        if (!cancelled) setFund(null)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const t = {
    title: es ? 'Programa de Referidos' : 'Referral Program',
    subtitle: es
      ? 'Invita personas y gana recompensas cuando actúan.'
      : 'Invite people and earn rewards when they take action.',
    howTitle: es ? 'Cómo funciona' : 'How it works',
    form1Title: es ? 'Compras de cursos' : 'Course purchases',
    form1: es
      ? 'Gana el 10% del precio del curso cuando alguien que referiste compra un curso. Se paga 50% USDT + 50% SLEARN (el valor varía según la moneda usada para pagar: SLEARN tiene 10% de descuento).'
      : 'Earn 10% of the course price when someone you referred buys a course. Paid 50% USDT + 50% SLEARN (the value varies by the currency used to pay: SLEARN has a 10% discount).',
    form2Title: es ? 'Becas de cursos misionales' : 'Missional course scholarships',
    form2: es
      ? 'Gana el 10% del valor de la beca cuando alguien que referiste completa un crucigrama en un curso misional. El alumno conserva el 100% de su beca.'
      : 'Earn 10% of the scholarship value when someone you referred completes a crossword in a missional course. The student keeps 100% of their scholarship.',
    fundTitle: es ? 'Billetera de referidos' : 'Referral wallet',
    fundAvailable: es ? 'Disponible para distribuir' : 'Available to distribute',
    fundUnavailable: es
      ? 'No se pudo consultar la billetera de referidos en este momento.'
      : 'Could not read the referral wallet right now.',
    noFundsNote: es
      ? 'Las recompensas se pagan desde la billetera de referidos. Si no tiene fondos, no se entrega recompensa.'
      : 'Rewards are paid from the referral wallet. If it has no funds, no reward is given.',
    cta: es ? 'Regístrate en learn.tg' : 'Sign up on learn.tg',
  }

  return (
    <div className="bg-gradient-to-br from-white via-gray-50 to-gray-100 min-h-screen">
      <div className="container mx-auto py-12 px-4 md:px-6 max-w-3xl">
        <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-8 md:p-12 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">{t.title}</h1>
          <p className="text-lg text-gray-600 mb-8">{t.subtitle}</p>

          <div className="text-left space-y-6 mb-8">
            <h2 className="text-xl font-bold text-gray-800">{t.howTitle}</h2>

            <div className="rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-2">{t.form1Title}</h3>
              <p className="text-gray-700">{t.form1}</p>
            </div>

            <div className="rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-2">{t.form2Title}</h3>
              <p className="text-gray-700">{t.form2}</p>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-6">
            <h2 className="font-semibold text-gray-800 mb-3">{t.fundTitle}</h2>
            {fund !== null ? (
              <div className="space-y-2">
                <p className="text-gray-700">
                  <span className="text-sm text-gray-500">{t.fundAvailable}:</span>{' '}
                  <span className="font-semibold text-green-700">{fund.slearnBalance} SLEARN</span>
                  <span className="text-gray-500"> · </span>
                  <span className="font-semibold text-blue-700">{fund.usdtBalance} USDT</span>
                </p>
                <p className="text-xs text-gray-500">{t.noFundsNote}</p>
              </div>
            ) : (
              <p className="text-gray-500">{t.fundUnavailable}</p>
            )}
          </div>

          <Link
            href={`/${lang}`}
            className="inline-block rounded bg-primary px-8 py-3 text-base font-semibold text-white hover:opacity-90"
          >
            {t.cta}
          </Link>
        </div>
      </div>
    </div>
  )
}
