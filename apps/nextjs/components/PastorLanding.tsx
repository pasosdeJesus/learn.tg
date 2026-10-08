'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import axios from 'axios'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'

// R-#283: pastor landing. Based on the old `GdPastoresLanding`, but it no longer
// announces the Global Disciples course nor the "non-Zionist" condition: the 22
// SLEARN welcome bonus is for **every** pastor who verifies their data and their
// church's data, while the churches fund has SLEARN. The GD course (and its
// conditions) is presented only in-app to the pastors who can take it.

const BONUS_SLEARN = 22

export function PastorLanding({ lang }: { lang: string }) {
  const es = lang === 'es'
  const { address, isAuthenticated, isWalletAvailable, isWalletCheckComplete } = useAuthAddress()

  const [fundSlearn, setFundSlearn] = useState<string | null>(null)
  const [profile, setProfile] = useState<Record<string, any> | null>(null)
  const [pastorBonus, setPastorBonus] = useState<{ hash: string } | null>(null)

  const profileUrl = `/${lang}/profile`
  const web3ubi = es ? '/es/web3-e-ibu' : '/en/web3-and-ubi'

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

  useEffect(() => {
    if (!isAuthenticated || !address) { setProfile(null); setPastorBonus(null); return }
    let cancelled = false
    ;(async () => {
      try {
        const res = await axios.get(`/api/profile?walletAddress=${encodeURIComponent(address)}`)
        if (cancelled) return
        setProfile(res.data)
        if (res.data?.id) {
          try {
            const txRes = await axios.get(`/api/user-transactions/${res.data.id}`)
            const bonus = (txRes.data?.transactions || []).find((tx: any) => tx.type === 'pastor_bonus')
            if (!cancelled) setPastorBonus(bonus?.hash ? { hash: bonus.hash } : null)
          } catch {
            if (!cancelled) setPastorBonus(null)
          }
        } else {
          setPastorBonus(null)
        }
      } catch {
        if (!cancelled) { setProfile(null); setPastorBonus(null) }
      }
    })()
    return () => { cancelled = true }
  }, [address, isAuthenticated])

  const remainingPastors = fundSlearn !== null ? Math.floor(Number(fundSlearn) / BONUS_SLEARN) : null
  const hasWallet = isWalletAvailable
  const noWallet = isWalletCheckComplete && !isWalletAvailable
  const isProduction = process.env.NODE_ENV === 'production'

  const t = {
    title: es ? 'Bienvenido, pastor' : 'Welcome, pastor',
    subtitle: es
      ? 'Para pastores de learn.tg'
      : 'For learn.tg pastors',
    intro: es
      ? 'learn.tg regala 22 SLEARN (= US$1) a todo pastor que verifique sus datos y los de su iglesia, mientras el fondo de iglesias tenga fondos.'
      : 'learn.tg gives 22 SLEARN (= US$1) to every pastor who verifies their data and their church\'s data, while the churches fund has SLEARN.',
    requirements: es ? 'Requisitos' : 'Requirements',
    claimedTitle: es ? 'Ya reclamaste tu bono' : 'You already claimed your bonus',
    claimedDesc: es
      ? 'Usted ya cumplió los requisitos y reclamó su bono de 22 SLEARN.'
      : 'You already met the requirements and claimed your 22 SLEARN bonus.',
    claimedTx: es ? 'La transacción fue' : 'The transaction was',
    autoNote: es
      ? 'El bono se acredita automáticamente cuando se verifican tus datos y el registro de tu iglesia.'
      : 'The bonus is credited automatically once your data and your church registration are verified.',
    pathTitle: es ? 'Tu camino como pastor' : 'Your path as a pastor',
    pathStep4: es
      ? 'Opcional: completa crucigramas en otros cursos para ganar USDT y SLEARN.'
      : 'Optional: complete crosswords in other courses to earn USDT and SLEARN.',
    fundTitle: es ? 'Fondo de iglesias para financiar bonos de pastores' : 'Churches fund to finance pastor bonuses',
    fundAvailable: es ? 'SLEARN disponibles' : 'SLEARN available',
    fundPastors: es ? 'financia ~{{n}} pastores más' : 'funds ~{{n}} more pastors',
    fundUnavailable: es ? 'No se pudo consultar el fondo en este momento.' : 'Could not read the fund right now.',
    learnWalletsTitle: es ? '¿No conoces billeteras?' : 'New to wallets?',
    learnWalletsDesc: es
      ? 'Toma el curso Web3 & UBI, donde aprenderás a usar una billetera y a reclamar un pequeño ingreso diario.'
      : 'Take the Web3 & UBI course, where you will learn to use a wallet and claim a small daily income.',
    learnWalletsCta: es ? 'Ir al curso gratuito Web3 & UBI' : 'Go to the free Web3 & UBI course',
    nextStepLabel: es ? 'Siguiente paso' : 'Next step',
    ctaSub: es
      ? 'Conecta tu billetera, completa tu perfil y declara tu iglesia.'
      : 'Connect your wallet, complete your profile, and declare your church.',
  }

  // Requirements (R-#283): wallet, be a pastor, church registration, verification.
  const requirements = [
    {
      key: 'wallet',
      met: hasWallet,
      label: es ? 'Tener billetera y conectarla a este sitio' : 'Have a wallet and connect it to this site',
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
      key: 'verified',
      met: !!profile && profile.verified_church_relationship === 'pastor',
      label: es
        ? 'Que el verificador confirme tu rol y el registro de tu iglesia'
        : 'Have a verifier confirm your role and your church registration',
    },
  ]

  let nextStep: { href: string; label: string }
  if (noWallet) {
    nextStep = { href: web3ubi, label: es ? 'Ir al curso Web3 & UBI' : 'Go to the Web3 & UBI course' }
  } else if (hasWallet || isAuthenticated) {
    nextStep = { href: profileUrl, label: es ? 'Completa tu perfil' : 'Complete your profile' }
  } else {
    nextStep = { href: `/${lang}`, label: es ? 'Regístrate en learn.tg' : 'Sign up on learn.tg' }
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
                    href={isProduction ? `https://celoscan.io/tx/${pastorBonus.hash}` : `https://sepolia.celoscan.io/tx/${pastorBonus.hash}`}
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
                <Link href={web3ubi} className="text-primary underline">Web3 &amp; UBI</Link>
                {es ? '.' : ' course.'}
              </li>
              <li>
                {es ? 'Conecta tu billetera y completa tu ' : 'Connect your wallet and complete your '}
                <Link href={profileUrl} className="text-primary underline">{es ? 'perfil' : 'profile'}</Link>
                {es
                  ? ' (tus datos y los de tu iglesia) y propón una fecha de entrevista. Una vez se verifiquen tus datos y el registro de tu iglesia, ganarás 22 SLEARN automáticamente.'
                  : ' (your data and your church) and propose an interview date. Once your data and your church registration are verified, you will earn 22 SLEARN automatically.'}
              </li>
              <li>
                {es
                  ? 'Regresa al curso Web3 & UBI y reclama tu UBI diario en CELO (necesitarás el token CELO para pagar el gas de las transacciones).'
                  : 'Return to the Web3 & UBI course and claim your daily UBI in CELO (you will need the CELO token to pay for transaction gas).'}
              </li>
              <li>{t.pathStep4}</li>
            </ol>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-8">
            <h2 className="font-semibold text-gray-800 mb-3">{t.fundTitle}</h2>
            {fundSlearn !== null ? (
              <p className="text-gray-700">
                <span className="font-semibold text-green-700">{fundSlearn} SLEARN</span>
                {remainingPastors !== null && (
                  <span className="text-gray-500"> · {t.fundPastors.replace('{{n}}', String(remainingPastors))}</span>
                )}
              </p>
            ) : (
              <p className="text-gray-500">{t.fundUnavailable}</p>
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
            <Link href={web3ubi} className="inline-block rounded border border-primary px-6 py-2 text-sm font-semibold text-primary hover:opacity-90">
              {t.learnWalletsCta}
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
