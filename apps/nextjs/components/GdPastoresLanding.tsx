'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import axios from 'axios'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { SCORE_RULES } from '@/lib/score-rules'
import { IS_PRODUCTION } from '@learn-tg/rewards/lib/config'

// Labels aligned with SCORE_RULES order (lib/score-rules.ts)
const SCORE_LABELS = [
  { en: 'Name verified (matches passport)', es: 'Nombre verificado (coincide con el pasaporte)' },
  { en: 'Country verified (matches passport nationality)', es: 'País verificado (coincide con la nacionalidad del pasaporte)' },
  { en: 'Email verified', es: 'Correo verificado' },
  { en: 'WhatsApp or Telegram verified', es: 'WhatsApp o Telegram verificado' },
  { en: 'GoodDollar facial verification', es: 'Verificación facial GoodDollar' },
  { en: 'Location verified (city)', es: 'Ubicación verificada (ciudad)' },
  { en: 'Church membership/role verified', es: 'Iglesia/rol verificado' },
  { en: 'Interview scheduled', es: 'Entrevista programada' },
]

export function GdPastoresLanding({ lang }: { lang: string }) {
  const es = lang === 'es'

  const {
    address,
    isAuthenticated,
    isWalletAvailable,
    isWalletCheckComplete,
  } = useAuthAddress()

  const [fundSlearn, setFundSlearn] = useState<string | null>(null)
  const [profile, setProfile] = useState<Record<string, any> | null>(null)
  const [funds, setFunds] = useState<{ countries: any[]; clusters: any[] } | null>(null)
  const [pastorBonus, setPastorBonus] = useState<{ hash: string } | null>(null)

  const courses = es
    ? { web3ubi: '/es/web3-e-ibu', gd: '/es/redgd' }
    : { web3ubi: '/en/web3-and-ubi', gd: '/en/gdcluster' }
  const profileUrl = `/${lang}/profile`
  const rankingUrl = `/${lang}/gdcluster/ranking`

  // Churches fund (44 SLEARN bonus source)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await axios.get('/api/churches/fund')
        if (!cancelled) setFundSlearn(res.data?.slearnBalance ?? null)
      } catch {
        if (!cancelled) setFundSlearn(null)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Current user profile (score, religion, church role, verified fields)
  useEffect(() => {
    if (!isAuthenticated || !address) {
      setProfile(null)
      setPastorBonus(null)
      return
    }
    const token = localStorage.getItem('learn.tg.authToken') || ''
    if (!token) {
      setProfile(null)
      setPastorBonus(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await axios.get(
          `/api/profile?walletAddress=${encodeURIComponent(address)}&token=${encodeURIComponent(token)}`,
        )
        if (cancelled) return
        setProfile(res.data)
        if (res.data?.id) {
          try {
            const txRes = await axios.get(`/api/user-transactions/${res.data.id}`)
            const bonus = (txRes.data?.transactions || []).find(
              (tx: any) => tx.type === 'pastor_bonus',
            )
            if (!cancelled) setPastorBonus(bonus?.hash ? { hash: bonus.hash } : null)
          } catch {
            if (!cancelled) setPastorBonus(null)
          }
        } else {
          setPastorBonus(null)
        }
      } catch {
        if (!cancelled) setProfile(null)
        if (!cancelled) setPastorBonus(null)
      }
    })()
    return () => { cancelled = true }
  }, [address, isAuthenticated])

  // Accumulated funds by country/cluster (ranking)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await axios.get('/api/gdcluster/ranking/funds')
        if (!cancelled) setFunds(res.data)
      } catch {
        if (!cancelled) setFunds(null)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const remainingPastors =
    fundSlearn !== null ? Math.floor(Number(fundSlearn) / 44) : null

  // Situation detection
  const score = profile?.profilescore != null ? Number(profile.profilescore) : null
  const religionId = profile?.religion_id
  const isChristian = religionId === 2
  const hasWallet = isWalletAvailable
  const noWallet = isWalletCheckComplete && !isWalletAvailable
  const partialProfile = score !== null && score > 0 && score < 90

  // Dynamic "next step"
  let nextStep: { href: string; label: string }
  if (noWallet) {
    nextStep = {
      href: courses.web3ubi,
      label: es ? 'Ir al curso Web3 & UBI' : 'Go to the Web3 & UBI course',
    }
  } else if (score !== null && score >= 90 && isChristian) {
    nextStep = {
      href: courses.gd,
      label: es ? 'Ir al curso Global Disciples' : 'Go to the Global Disciples course',
    }
  } else if (hasWallet || isAuthenticated) {
    nextStep = {
      href: profileUrl,
      label: es ? 'Completa tu perfil' : 'Complete your profile',
    }
  } else {
    nextStep = { href: `/${lang}`, label: es ? 'Regístrate en learn.tg' : 'Sign up on learn.tg' }
  }

  // Detailed analysis: any user with a partially filled profile (0 < score < 90)
  const showAnalysis = partialProfile
  const missingItems = showAnalysis
    ? SCORE_RULES.map((rule, i) => ({
        points: rule.points,
        satisfied: rule.check(profile!),
        label: es ? SCORE_LABELS[i].es : SCORE_LABELS[i].en,
        mandatory: rule.points >= 9,
      })).filter((item) => !item.satisfied)
    : []

  // Checklist of requirements, ordered like the profile form
  const requirements = [
    {
      key: 'wallet',
      met: hasWallet,
      label: es ? 'Tener billetera y conectarla a este sitio' : 'Have a wallet and connect it to this site',
    },
    {
      key: 'country',
      met: !!profile && (profile.pais_id === 170 || profile.pais_id === 694),
      label: es ? 'Vivir en Colombia o Sierra Leona' : 'Live in Colombia or Sierra Leone',
    },
    {
      key: 'nonZionist',
      met: !!profile && profile.position_israel_gaza === 'no',
      label: es ? 'No ser sionista' : 'Not be a zionist',
    },
    {
      key: 'pastor',
      met: !!profile && profile.church_relationship === 'pastor',
      label: es ? 'Ser un pastor' : 'Be a pastor',
    },
    {
      key: 'churchReg',
      met: !!profile && (profile.registration != null || profile.registration_photo != null),
      label: es ? 'Proveer el registro de su iglesia' : 'Provide your church registration',
    },
    {
      key: 'interview',
      met: !!profile && profile.conducted_date_of_interview != null,
      label: es
        ? 'Propón y asiste a una cita de verificación para alcanzar más de 90 puntos en tu perfil'
        : 'Propose and attend a verification appointment to reach more than 90 points in your profile',
    },
  ]

  const t = {
    title: es
      ? 'Herramientas para traer Discípulos Globales (GD) a tu red de iglesias'
      : 'Tools to bring Global Disciples (GD) to your cluster of churches',
    subtitle: es
      ? 'Invitación a pastores de Colombia y Sierra Leona'
      : 'An invitation to pastors in Sierra Leone and Colombia',
    intro: es
      ? 'El curso de GD se puede pagar en SLEARN. Para darte la bienvenida, learn.tg te regala 44 SLEARN (= US$2) al cumplir los requisitos.'
      : 'The GD course can be paid in SLEARN. To welcome you, learn.tg gives you 44 SLEARN (= US$2) once you meet the requirements.',
    requirements: es ? 'Requisitos' : 'Requirements',
    claimedTitle: es ? 'Ya reclamaste tu bono' : 'You already claimed your bonus',
    claimedDesc: es
      ? 'Usted ya cumplió los requisitos y reclamó su bono de 44 SLEARN.'
      : 'You already met the requirements and claimed your 44 SLEARN bonus.',
    claimedTx: es ? 'La transacción fue' : 'The transaction was',
    autoNote: es
      ? 'El bono se acredita automáticamente cuando se verifican tus datos y el registro de tu iglesia.'
      : 'The bonus is credited automatically once your data and your church registration are verified.',
    pathTitle: es ? 'Tu camino como pastor' : 'Your path as a pastor',
    pathStep4: es
      ? 'Opcional: completa crucigramas en otros cursos para ganar USDT y SLEARN.'
      : 'Optional: complete crosswords in other courses to earn USDT and SLEARN.',
    pathStep5Hint: es
      ? 'Si te falta USDT y estás en Sierra Leona, te recomendamos'
      : 'If you are short on USDT and in Sierra Leone, we recommend',
    gdTitle: es
      ? '¿Por qué es importante el curso Global Disciples?'
      : 'Why is the Global Disciples course important?',
    gdDesc: es
      ? 'Prepara a tu iglesia para aplicar al proceso de Discípulos Globales quienes ayudan económicamente y con formación para que tu red de iglesias conforme una academia autosostenible de "Discipulado" y de "Desarrollo de Pequeños Negocios," que forme líderes, misioneros plantadores de iglesias y pastores que puedan sostenerse económicamente y compartir el evangelio con los no alcanzados. Este curso te prepara para iniciar el proceso y es a su vez herramienta para levantar los fondos iniciales que se requieren.'
      : 'Prepare your church to apply to the Global Disciples process, who help economically and with training so that your network of churches forms a self-sustaining academy of "Discipleship" and "Small Business Development," that trains leaders, missionary church planters, and pastors who can sustain themselves economically and share the gospel with the unreached. This course prepares you to start the process and is also a tool to raise the initial funds required.',
    fundTitle: es
      ? 'Fondo de iglesias para financiar bonos de pastores'
      : 'Churches fund to finance pastor bonuses',
    fundAvailable: es ? 'SLEARN disponibles' : 'SLEARN available',
    fundPastors: es ? 'financia ~{{n}} pastores más' : 'funds ~{{n}} more pastors',
    fundUnavailable: es ? 'No se pudo consultar el fondo en este momento.' : 'Could not read the fund right now.',
    learnWalletsTitle: es ? '¿No conoces billeteras?' : 'New to wallets?',
    learnWalletsDesc: es
      ? 'Toma el curso Web3 & UBI, donde aprenderás a usar una billetera y a reclamar un pequeño ingreso diario.'
      : 'Take the Web3 & UBI course, where you will learn to use a wallet and claim a small daily income.',
    learnWalletsCta: es ? 'Ir al curso gratuito Web3 & UBI' : 'Go to the free Web3 & UBI course',
    rankingTitle: es ? 'Ranking de países y clusters' : 'Country and cluster ranking',
    rankingSub: es
      ? 'Lo acumulado por país y clúster para cubrir los costos iniciales.'
      : 'Amounts accumulated by country and cluster to cover initial costs.',
    rankingCountries: es ? 'Países' : 'Countries',
    rankingClusters: es ? 'Clústeres' : 'Clusters',
    rankingEmpty: es ? 'Aún no hay fondos acumulados.' : 'No funds accumulated yet.',
    nextStepLabel: es ? 'Siguiente paso' : 'Next step',
    ctaSub: es
      ? 'Conecta tu billetera, completa tu perfil y declara tu iglesia.'
      : 'Connect your wallet, complete your profile, and declare your church.',
    analysisTitle: es
      ? 'Lo que te falta para superar 90 puntos'
      : 'What you still need to exceed 90 points',
    analysisIntro: es
      ? 'Para recibir el bono de 44 SLEARN debes superar 90 puntos. Te falta completar:'
      : 'To receive the 44 SLEARN bonus you must exceed 90 points. You still need to complete:',
    analysisMandatory: es ? 'obligatorio' : 'mandatory',
    analysisOptional: es ? 'recomendado' : 'recommended',
    analysisCurrent: es ? 'Puntaje actual' : 'Current score',
  }

  const flagEmoji = (iso2: string) => {
    if (!iso2 || iso2.length !== 2) return ''
    const a = iso2.toUpperCase().charCodeAt(0) + 127397
    const b = iso2.toUpperCase().charCodeAt(1) + 127397
    return String.fromCodePoint(a, b)
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
            {pastorBonus ? (
              <div className="text-gray-700">
                <p className="font-medium text-green-700 mb-2">✓ {t.claimedTitle}</p>
                <p>{t.claimedDesc}</p>
                <p className="mt-2">
                  {t.claimedTx}{' '}
                  <a
                    href={
                      IS_PRODUCTION
                        ? `https://celoscan.io/tx/${pastorBonus.hash}`
                        : `https://sepolia.celoscan.io/tx/${pastorBonus.hash}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline font-mono text-sm break-all"
                  >
                    {pastorBonus.hash.slice(0, 10)}…{pastorBonus.hash.slice(-6)}
                  </a>
                </p>
              </div>
            ) : (
              <>
                <ul className="space-y-2 text-gray-700">
                  {requirements.map((req) => (
                    <li key={req.key} className="flex items-start gap-2">
                      <span
                        className={`mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded border text-sm shrink-0 ${
                          req.met ? 'bg-green-600 border-green-600 text-white' : 'border-gray-400'
                        }`}
                      >
                        {req.met ? '✓' : ''}
                      </span>
                      <span className={req.met ? '' : 'text-gray-600'}>{req.label}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-gray-500 mt-3">{t.autoNote}</p>
              </>
            )}
          </div>

          <div className="text-left bg-white border border-gray-200 rounded-xl p-6 mb-8">
            <h2 className="font-semibold text-gray-800 mb-3">{t.pathTitle}</h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>
                {es ? 'Configura tu billetera y aprende a usar la plataforma en el curso ' : 'Set up your wallet and learn to use the platform in the '}
                <Link href={courses.web3ubi} className="text-primary underline">
                  Web3 &amp; UBI
                </Link>
                {es ? '.' : ' course.'}
              </li>
              <li>
                {es ? 'Conecta tu billetera y completa tu ' : 'Connect your wallet and complete your '}
                <Link href={profileUrl} className="text-primary underline">
                  {es ? 'perfil' : 'profile'}
                </Link>
                {es
                  ? ' (tus datos y los de tu iglesia) y propón una fecha de entrevista. Si suministras toda la información tendrás más de 90 puntos y, una vez se verifiquen los documentos que envías, ganarás 44 SLEARN automáticamente.'
                  : ' (your data and your church) and propose an interview date. If you supply all the information you will have more than 90 points, and once the documents you send are verified you will earn 44 SLEARN automatically.'}
              </li>
              <li>
                {es
                  ? 'Regresa al curso Web3 & UBI y reclama tu UBI diario en CELO (necesitarás el token CELO para pagar el gas de las transacciones).'
                  : 'Return to the Web3 & UBI course and claim your daily UBI in CELO (you will need the CELO token to pay for transaction gas).'}
              </li>
              <li>{t.pathStep4}</li>
              <li>
                {es ? 'Entra al curso ' : 'Enter the '}
                <Link href={courses.gd} className="text-primary underline">
                  {es ? 'Global Disciples' : 'Global Disciples'}
                </Link>
                {es ? ' y págalo con SLEARN y/o USDT.' : ' course and pay with SLEARN and/or USDT.'}
                <div className="text-sm text-gray-500 mt-1">
                  {t.pathStep5Hint}{' '}
                  <a href="https://stable-sl.pdJ.app" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    stable-sl.pdJ.app
                  </a>
                </div>
              </li>
            </ol>
          </div>

          {showAnalysis && (
            <div className="text-left bg-orange-50 border border-orange-200 rounded-xl p-6 mb-8">
              <h2 className="font-semibold text-gray-800 mb-2">{t.analysisTitle}</h2>
              <p className="text-sm text-gray-600 mb-3">
                {t.analysisIntro}{' '}
                <span className="font-semibold">{t.analysisCurrent}: {score}</span>
              </p>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                {missingItems.map((item) => (
                  <li key={item.label}>
                    <span className="font-medium">{item.label}</span>
                    <span className="text-gray-500"> (+{item.points} pts, {item.mandatory ? t.analysisMandatory : t.analysisOptional})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

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

          <div className="text-left bg-white border border-gray-200 rounded-xl p-6 mb-8">
            <h2 className="font-semibold text-gray-800 mb-2">{t.rankingTitle}</h2>
            <p className="text-sm text-gray-500 mb-4">{t.rankingSub}</p>
            {funds && (funds.countries.length > 0 || funds.clusters.length > 0) ? (
              <div className="space-y-4">
                {funds.countries.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">{t.rankingCountries}</h3>
                    <ul className="space-y-1 text-gray-700">
                      {funds.countries.map((c) => (
                        <li key={c.country_code || c.country_name} className="flex justify-between">
                          <span>
                            {c.country_code ? `${flagEmoji(c.country_code)} ` : ''}
                            {c.country_name || c.country_code || '—'}
                          </span>
                          <span className="font-mono text-sm">≈ {Number(c.total).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {funds.clusters.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">{t.rankingClusters}</h3>
                    <ul className="space-y-1 text-gray-700">
                      {funds.clusters.map((c) => (
                        <li key={c.cluster_wallet || c.cluster_name} className="flex justify-between">
                          <span>{c.cluster_name || c.cluster_wallet || '—'}</span>
                          <span className="font-mono text-sm">≈ {Number(c.total).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <Link href={rankingUrl} className="text-sm text-primary underline">
                  {es ? 'Ver ranking completo' : 'See full ranking'}
                </Link>
              </div>
            ) : (
              <p className="text-gray-500">{t.rankingEmpty}</p>
            )}
          </div>

          <div>
            {hasWallet && (
              <>
                <p className="text-sm font-semibold text-gray-500 mb-2">{t.nextStepLabel}</p>
                <Link
                  href={nextStep.href}
                  style={{ color: '#ffffff' }}
                  className="inline-block rounded bg-primary px-8 py-3 text-base font-semibold hover:opacity-90"
                >
                  {nextStep.label}
                </Link>
                <p className="text-sm text-gray-500 mt-3">{t.ctaSub}</p>
              </>
            )}
          </div>
        </div>

        {noWallet && (
          <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-8 mt-6 text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-3">{t.learnWalletsTitle}</h2>
            <p className="text-gray-700 mb-4">{t.learnWalletsDesc}</p>
            <Link
              href={courses.web3ubi}
              className="inline-block rounded border border-primary px-6 py-2 text-sm font-semibold text-primary hover:opacity-90"
            >
              {t.learnWalletsCta}
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
