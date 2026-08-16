'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import axios from 'axios'

export function GdPastoresLanding({ lang }: { lang: string }) {
  const es = lang === 'es'

  const [fundSlearn, setFundSlearn] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await axios.get('/api/churches/fund')
        if (cancelled) return
        setFundSlearn(res.data?.slearnBalance ?? null)
      } catch {
        if (!cancelled) setFundSlearn(null)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const remainingPastors =
    fundSlearn !== null ? Math.floor(Number(fundSlearn) / 44) : null

  const t = {
    title: es ? 'Curso de Discípulos Globales (GD)' : 'Global Disciples (GD) course',
    subtitle: es
      ? 'Invitación a pastores de Colombia y Sierra Leona'
      : 'An invitation to pastors in Colombia and Sierra Leone',
    intro: es
      ? 'El curso de GD se puede pagar en SLEARN. Para darte la bienvenida, learn.tg te regala 44 SLEARN (= US$2) al cumplir los requisitos.'
      : 'The GD course can be paid in SLEARN. To welcome you, learn.tg gives you 44 SLEARN (= US$2) once you meet the requirements.',
    requirements: es ? 'Requisitos' : 'Requirements',
    reqPastor: es ? 'Ser pastor (relación con la iglesia: pastor).' : 'Be a pastor (church relationship: pastor).',
    reqCountry: es ? 'Vivir en Colombia o Sierra Leona (países del pilotaje).' : 'Live in Colombia or Sierra Leone (pilot countries).',
    reqProfile: es ? 'Obtener más de 90 puntos en tu perfil.' : 'Score more than 90 points in your profile.',
    reqChurch: es
      ? 'Suministrar el documento de registro de tu iglesia y que sea confirmado como correcto.'
      : 'Provide your church\'s registration document and have it confirmed as correct.',
    reqNonZionist: es
      ? 'Responder "No" a la pregunta sobre Israel y Gaza.'
      : 'Answer "No" to the question about Israel and Gaza.',
    autoNote: es
      ? 'El bono se acredita automáticamente cuando se verifican tus datos y el registro de tu iglesia.'
      : 'The bonus is credited automatically once your data and your church registration are verified.',
    pathTitle: es ? 'Tu camino como pastor' : 'Your path as a pastor',
    pathStep1: es
      ? 'Configura tu billetera y aprende a usar la plataforma en el curso Web3 & UBI.'
      : 'Set up your wallet and learn to use the platform in the Web3 & UBI course.',
    pathStep2: es
      ? 'Completa tu perfil (tus datos y los de tu iglesia) y propón una fecha de entrevista. Si suministras toda la información tendrás más de 90 puntos y, una vez se verifiquen los documentos que envías, ganarás 44 SLEARN automáticamente.'
      : 'Complete your profile (your data and your church) and propose an interview date. If you supply all the information you will have more than 90 points, and once the documents you send are verified you will earn 44 SLEARN automatically.',
    pathStep3: es
      ? 'Regresa al curso Web3 & UBI y reclama tu UBI diario (necesitas CELO para el gas).'
      : 'Return to the Web3 & UBI course and claim your daily UBI (you need CELO for gas).',
    pathStep4: es
      ? 'Opcional: completa crucigramas en otros cursos para ganar USDT y SLEARN.'
      : 'Optional: complete crosswords in other courses to earn USDT and SLEARN.',
    pathStep5: es
      ? 'Entra al curso Global Disciples y págalo con SLEARN y/o USDT.'
      : 'Enter the Global Disciples course and pay with SLEARN and/or USDT.',
    pathStep5Hint: es
      ? 'Si te falta USDT y estás en Sierra Leona, te recomendamos'
      : 'If you are short on USDT and in Sierra Leone, we recommend',
    gdTitle: es
      ? '¿Por qué es importante el curso Global Disciples?'
      : 'Why is the Global Disciples course important?',
    gdDesc: es
      ? 'Prepara a tu iglesia para aplicar al proceso de Global Disciples y abre la puerta a recursos para tu comunidad. Su contenido completo lo descubrirás al pagarlo.'
      : 'It prepares your church to apply to the Global Disciples process and opens the door to resources for your community. You will discover its full content once you pay.',
    fundTitle: es ? 'Fondo de iglesias' : 'Churches fund',
    fundAvailable: es ? 'SLEARN disponibles' : 'SLEARN available',
    fundPastors: es
      ? 'financia ~{{n}} pastores más'
      : 'funds ~{{n}} more pastors',
    fundUnavailable: es ? 'No se pudo consultar el fondo en este momento.' : 'Could not read the fund right now.',
    learnWalletsTitle: es ? '¿No conoces billeteras?' : 'New to wallets?',
    learnWalletsDesc: es
      ? 'Toma el curso Web3 & UBI, donde aprenderás a usar una billetera y a reclamar un pequeño ingreso diario.'
      : 'Take the Web3 & UBI course, where you will learn to use a wallet and claim a small daily income.',
    learnWalletsCta: es ? 'Ir al curso Web3 & UBI' : 'Go to the Web3 & UBI course',
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

          <div className="text-left bg-white border border-gray-200 rounded-xl p-6 mb-8">
            <h2 className="font-semibold text-gray-800 mb-3">{t.pathTitle}</h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>{t.pathStep1}</li>
              <li>{t.pathStep2}</li>
              <li>{t.pathStep3}</li>
              <li>{t.pathStep4}</li>
              <li>
                {t.pathStep5}
                <div className="text-sm text-gray-500 mt-1">
                  {t.pathStep5Hint}{' '}
                  <a href="https://stable-sl.pdJ.app" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    stable-sl.pdJ.app
                  </a>
                </div>
              </li>
            </ol>
          </div>

          <div className="text-left bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
            <h2 className="font-semibold text-gray-800 mb-2">{t.gdTitle}</h2>
            <p className="text-gray-700">{t.gdDesc}</p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-8">
            <h2 className="font-semibold text-gray-800 mb-3">{t.fundTitle}</h2>
            {fundSlearn !== null ? (
              <p className="text-gray-700">
                <span className="font-semibold text-green-700">{fundSlearn} SLEARN</span>
                {remainingPastors !== null && (
                  <span className="text-gray-500">
                    {' '}
                    · {t.fundPastors.replace('{{n}}', String(remainingPastors))}
                  </span>
                )}
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

        <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-8 mt-6 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-3">{t.learnWalletsTitle}</h2>
          <p className="text-gray-700 mb-4">{t.learnWalletsDesc}</p>
          <Link
            href="/en/web3-and-ubi"
            className="inline-block rounded border border-primary px-6 py-2 text-sm font-semibold text-primary hover:opacity-90"
          >
            {t.learnWalletsCta}
          </Link>
        </div>
      </div>
    </div>
  )
}
