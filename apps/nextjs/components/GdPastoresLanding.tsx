'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import axios from 'axios'

export function GdPastoresLanding({ lang }: { lang: string }) {
  const es = lang === 'es'

  const [fundSlearn, setFundSlearn] = useState<string | null>(null)
  const [fundUsdt, setFundUsdt] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await axios.get('/api/churches/fund')
        if (cancelled) return
        setFundSlearn(res.data?.slearnBalance ?? null)
        setFundUsdt(res.data?.usdtBalance ?? null)
      } catch {
        if (!cancelled) { setFundSlearn(null); setFundUsdt(null) }
      }
    })()
    return () => { cancelled = true }
  }, [])

  const t = {
    title: es ? '44 SLEARN para pastores no-sionistas' : '44 SLEARN for non-Zionist pastors',
    subtitle: es
      ? 'Una invitación para pastores de Colombia y Sierra Leona'
      : 'An invitation for pastors in Colombia and Sierra Leone',
    intro: es
      ? 'Learn.tg te da 44 SLEARN automáticamente al completar tu perfil verificado, declarar tu iglesia con documento de registro confirmado y ser no-sionista.'
      : 'Learn.tg gives you 44 SLEARN automatically once your verified profile is complete, your church is declared with a confirmed registration document, and you are non-Zionist.',
    requirements: es ? 'Requisitos' : 'Requirements',
    reqPastor: es ? 'Ser pastor (relación con la iglesia: pastor).' : 'Be a pastor (church relationship: pastor).',
    reqCountry: es ? 'Vivir en Colombia o Sierra Leona (países del pilotaje).' : 'Live in Colombia or Sierra Leone (pilot countries).',
    reqProfile: es ? 'Completar tu perfil con los datos verificados (no se exige GoodDollar).' : 'Complete your profile with verified data (GoodDollar is not required).',
    reqChurch: es
      ? 'Suministrar el documento de registro de tu iglesia y que sea confirmado como correcto.'
      : 'Provide your church\'s registration document and have it confirmed as correct.',
    reqNonZionist: es
      ? 'Ser no-sionista: responder "No" a la pregunta sobre el apoyo incondicional al Estado de Israel en Gaza.'
      : 'Be non-Zionist: answer "No" to the question about unconditionally supporting the State of Israel in Gaza.',
    autoNote: es
      ? 'El bono se acredita automáticamente cuando se verifican tus datos y el registro de tu iglesia.'
      : 'The bonus is credited automatically once your data and your church registration are verified.',
    fundTitle: es ? 'Fondo de iglesias disponible' : 'Churches fund available',
    fundUnavailable: es ? 'No se pudo consultar el fondo en este momento.' : 'Could not read the fund right now.',
    cta: es ? 'Regístrate en learn.tg' : 'Sign up on learn.tg',
    ctaSub: es
      ? 'Conecta tu billetera, completa tu perfil y declara tu iglesia.'
      : 'Connect your wallet, complete your profile, and declare your church.',
  }

  return (
    <div className="bg-gradient-to-br from-white via-gray-50 to-gray-100 min-h-screen">
      <div className="container mx-auto py-12 px-4 md:px-6 max-w-3xl">
        <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-8 md:p-12 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">{t.title}</h1>
          <p className="text-lg text-gray-600 mb-6">{t.subtitle}</p>
          <p className="text-gray-700 mb-8">{t.intro}</p>

          <div className="text-left bg-amber-50 border border-amber-200 rounded-xl p-6 mb-8">
            <h2 className="font-semibold text-gray-800 mb-3">{t.requirements}</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>{t.reqPastor}</li>
              <li>{t.reqCountry}</li>
              <li>{t.reqProfile}</li>
              <li>{t.reqChurch}</li>
              <li>{t.reqNonZionist}</li>
            </ul>
            <p className="text-sm text-gray-500 mt-3">{t.autoNote}</p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-8">
            <h2 className="font-semibold text-gray-800 mb-3">{t.fundTitle}</h2>
            {fundSlearn !== null ? (
              <p className="text-gray-700">
                <span className="font-semibold text-green-700">{fundSlearn} SLEARN</span>
                {fundUsdt !== null && <span className="text-gray-500"> · {fundUsdt} USDT</span>}
              </p>
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
          <p className="text-sm text-gray-500 mt-3">{t.ctaSub}</p>
        </div>
      </div>
    </div>
  )
}
