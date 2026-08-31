'use client'

import { useEffect, useState } from 'react'
import { use } from 'react'
import Link from 'next/link'
import axios from 'axios'

type PageProps = {
  params: Promise<{ lang: string }>
}

export interface ReferralsPageDeps {
  useAuthAddress: () => { address?: string | null }
}

interface ReferralStats {
  total: number
  pending: number
  completed: number
  rewardsUsdt: number
  rewardsSlearn: number
}

interface HistoryReward {
  crypto: string
  amount: number
  type: string
  subcategoria: string | null
  date: string
}

export default function ReferralsPage({ params, deps }: PageProps & { deps?: ReferralsPageDeps }) {
  const { lang } = use(params)
  const es = lang === 'es'
  const address = deps?.useAuthAddress?.().address

  const [fund, setFund] = useState<{ slearnBalance: string | null; usdtBalance: string | null } | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [history, setHistory] = useState<HistoryReward[]>([])
  const [activated, setActivated] = useState(false)
  const [purchasedPremium, setPurchasedPremium] = useState(false)
  const [profileScore, setProfileScore] = useState<number | null>(null)
  const [referredBy, setReferredBy] = useState<{ id: number | null; nusuario: string | null; billetera: string | null } | null>(null)
  const [score, setScore] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [referrals, setReferrals] = useState<Array<{ referredId?: number; nusuario?: string | null; status: string; claimedAt: unknown }>>([])

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

  // Menú de referidos (solo autenticado)
  useEffect(() => {
    if (!address) { setCode(null); setStats(null); setHistory([]); setReferrals([]); setActivated(false); setPurchasedPremium(false); setProfileScore(null); setReferredBy(null); return }
    let cancelled = false
    const token = typeof window !== 'undefined' ? localStorage.getItem('learn.tg.authToken') : null
    ;(async () => {
      const q = `?walletAddress=${encodeURIComponent(address)}&token=${encodeURIComponent(token || '')}`
      const [codeRes, statsRes, histRes, profileRes] = await Promise.all([
        axios.get(`/api/referral/code${q}`).catch(() => null),
        axios.get(`/api/referral/stats${q}`).catch(() => null),
        axios.get(`/api/referral/history${q}`).catch(() => null),
        axios.get(`/api/profile${q}`).catch(() => null),
      ])
      if (cancelled) return
      setCode(codeRes?.data?.code ?? null)
      setActivated(!!codeRes?.data?.activated)
      setPurchasedPremium(!!codeRes?.data?.purchasedPremium)
      setProfileScore(typeof codeRes?.data?.profileScore === 'number' ? codeRes.data.profileScore : null)
      setReferredBy(codeRes?.data?.referredByDetails ?? null)
      setStats(statsRes?.data ?? null)
      setHistory(histRes?.data?.rewards ?? [])
      setReferrals(histRes?.data?.referrals ?? [])
      const scoreVal = profileRes?.data?.user?.profilescore ?? profileRes?.data?.profilescore
      setScore(typeof scoreVal === 'number' ? scoreVal : null)
    })()
    return () => { cancelled = true }
  }, [address])

  const copyCode = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(`https://learn.tg/${lang}/ref/${code}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard unavailable */ }
  }

  const t = {
    title: es ? 'Programa de Referidos' : 'Referral Program',
    subtitle: es
      ? 'Invita personas y gana recompensas cuando actúan.'
      : 'Invite people and earn rewards when they take action.',
    howTitle: es ? 'Cómo funciona' : 'How it works',
    form1Title: es ? 'Compras de cursos' : 'Course purchases',
    form1: es
      ? 'Gana el 10% del precio del curso cuando alguien que referiste compra un curso. Se paga 50% USDT + 50% SLEARN.'
      : 'Earn 10% of the course price when someone you referred buys a course. Paid 50% USDT + 50% SLEARN.',
    form2Title: es ? 'Becas de cursos misionales' : 'Missional course scholarships',
    form2: es
      ? 'Gana el 10% del valor de la beca cuando alguien que referiste completa un crucigrama en un curso misional. El alumno conserva el 100% de su beca.'
      : 'Earn 10% of the scholarship value when someone you referred completes a crossword in a missional course. The student keeps 100% of their scholarship.',
    form3Title: es ? 'Bono por pastor' : 'Pastor bonus',
    form3: es
      ? 'Gana 1 USDT extra cuando un pastor que referiste compra el curso Global Disciples.'
      : 'Earn an extra 1 USDT when a pastor you referred buys the Global Disciples course.',
    fundTitle: es ? 'Billetera de referidos' : 'Referral wallet',
    fundAvailable: es ? 'Disponible para distribuir' : 'Available to distribute',
    fundUnavailable: es ? 'No se pudo consultar la billetera de referidos en este momento.' : 'Could not read the referral wallet right now.',
    noFundsNote: es ? 'Las recompensas se pagan desde la billetera de referidos. Si no tiene fondos, no se entrega recompensa.' : 'Rewards are paid from the referral wallet. If it has no funds, no reward is given.',
    myReferrerTitle: es ? 'Mi referidor' : 'My referrer',
    referrerUser: es ? 'Usuario' : 'Username',
    referrerWallet: es ? 'Billetera' : 'Wallet',
    copyLink: es ? 'Copiar enlace' : 'Copy link',
    copiedOk: es ? '¡Enlace copiado!' : 'Link copied!',
    shareLink: es ? 'Comparte este enlace:' : 'Share this link:',
    referred: es ? 'Referidos' : 'Referrals',
    rewards: es ? 'Recompensas' : 'Rewards',
    historyTitle: es ? 'Historial de recompensas' : 'Reward history',
    loading: es ? 'Cargando…' : 'Loading…',
    // Adaptativo según estado
    reqTitle: es ? 'Requisitos para participar' : 'Requirements to join',
    reqBody: es
      ? 'El programa de referidos se activa cumpliendo ambos requisitos:'
      : 'The referral program activates when you meet both requirements:',
    reqPremium: es ? 'Comprar un curso premium (por ejemplo, Global Disciples).' : 'Buy a premium course (for example, Global Disciples).',
    reqScore: es ? 'Tener más de 90 puntos de perfil.' : 'Have more than 90 profile points.',
    stepsTitle: es ? 'Pasos para empezar' : 'Steps to get started',
    // Sin numeración manual: el <ol list-decimal> la agrega (evita "1. 1. ...")
    steps: es
      ? [
          'Completa tu perfil y agenda una cita de verificación.',
          'Una vez verificado y con más de 90 puntos en el perfil, compra un curso premium para activar tu código.',
          'Comparte tu enlace de referido.',
          'Gana el 10% cuando tus referidos compran o ganan becas, y 1 USDT por cada pastor que referiste al curso GD.',
        ]
      : [
          'Complete your profile and schedule a verification interview.',
          'Once verified and with more than 90 profile points, buy a premium course to activate your code.',
          'Share your referral link.',
          'Earn 10% when your referrals buy or earn scholarships, plus 1 USDT for each pastor you referred to the GD course.',
        ],
    goCourse: es ? 'Ver cursos premium' : 'See premium courses',
    enterCode: es
      ? 'Aún no tienes referidor. Puedes ingresar el código de quien te invitó desde tu perfil (sección Referidos).'
      : 'You do not have a referrer yet. You can enter the code of the person who invited you from your profile (Referrals section).',
    goProfile: es ? 'Ir a mi perfil' : 'Go to my profile',
    myReferralsTitle: es ? 'Mis referidos' : 'My referrals',
    emptyReferrals: es ? 'Aún no has referido a nadie.' : 'You have not referred anyone yet.',
    ctaNoWallet: es ? 'Ir al curso Web3 & UBI' : 'Go to the Web3 & UBI course',
    ctaNoWalletHint: es ? 'Crea tu billetera en el curso Web3 & UBI (Guía 2).' : 'Create your wallet in the Web3 & UBI course (Guide 2).',
    ctaProfile: es ? 'Completa tu perfil' : 'Complete your profile',
    ctaProfileHint: es ? 'Para activar tu código de referido completa tu perfil y agenda una entrevista de verificación.' : 'To activate your referral code, complete your profile and schedule a verification interview.',
    // CTA múltiple para quien ya tiene código activo
    promoTitle: es ? 'Promociona learn.tg' : 'Promote learn.tg',
    promoHint: es ? 'Comparte el programa y gana recompensas:' : 'Share the program and earn rewards:',
    invitePastors: es ? 'Invitar pastores' : 'Invite pastors',
    invitePastorsHint: es ? 'Presenta el programa de pastores a líderes de tu comunidad.' : 'Introduce the pastors program to community leaders.',
    inviteWhatsApp: es ? 'Invitar por WhatsApp' : 'Invite via WhatsApp',
    inviteWhatsAppHint: es ? 'Envía una invitación personal con tu enlace de referido.' : 'Send a personal invitation with your referral link.',
  }

  const courseHref = es ? `/${lang}/web3-e-ibu/guide1` : `/${lang}/web3-and-ubi/guide1`
  let ctaHref: string = courseHref
  let ctaLabel: string = t.ctaNoWallet
  let ctaHint: string = t.ctaNoWalletHint
  if (address && score != null && score <= 90) {
    ctaHref = `/${lang}/profile`
    ctaLabel = t.ctaProfile
    ctaHint = t.ctaProfileHint
  }

  // CTA múltiple para quien ya tiene el programa activado: invitar pastores
  // (landing del programa) y enviar una invitación personal por WhatsApp.
  const pastorsHref = es ? `/${lang}/redgd/pastores` : `/${lang}/gdcluster/pastors`
  const waMessage = es
    ? `¡Hola! Te invito a aprender en learn.tg: aprendes jugando y ganas recompensas en criptomonedas. Únete con mi invitación: https://learn.tg/${lang}/ref/${code}`
    : `Hi! I invite you to learn on learn.tg: you learn through games and earn crypto rewards. Join with my invitation: https://learn.tg/${lang}/ref/${code}`
  const waHref = `https://wa.me/?text=${encodeURIComponent(waMessage)}`

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
            <div className="rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-2">{t.form3Title}</h3>
              <p className="text-gray-700">{t.form3}</p>
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

          {address && !activated && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6 text-left">
              <h2 className="font-semibold text-gray-800 mb-2">{t.reqTitle}</h2>
              <p className="text-sm text-gray-700 mb-3">{t.reqBody}</p>
              <ul className="space-y-2 text-sm text-gray-700 mb-4">
                <li className="flex items-center gap-2">
                  <span className={purchasedPremium ? 'text-green-600' : 'text-gray-400'}>{purchasedPremium ? '✔' : '✖'}</span>
                  {t.reqPremium}
                </li>
                <li className="flex items-center gap-2">
                  <span className={profileScore != null && profileScore > 90 ? 'text-green-600' : 'text-gray-400'}>
                    {profileScore != null && profileScore > 90 ? '✔' : '✖'}
                  </span>
                  {t.reqScore}
                  {profileScore != null && <span className="text-gray-500">({profileScore})</span>}
                </li>
              </ul>
              <h3 className="font-semibold text-gray-800 mb-2">{t.stepsTitle}</h3>
              <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1 mb-4">
                {t.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
              <Link
                href={`/${lang}/gdcluster`}
                className="inline-block rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                {t.goCourse}
              </Link>
            </div>
          )}

          {address && activated && (
            <div className="space-y-6 mb-6">
              {/* Tarjeta 1: Mi referidor (quién me invitó: nombre, usuario, billetera) */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-left">
                <h2 className="font-semibold text-gray-800 mb-3">{t.myReferrerTitle}</h2>
                {referredBy ? (
                  <div className="space-y-2 text-sm text-gray-700">
                    <p>
                      <span className="font-semibold">{t.referrerUser}:</span>{' '}
                      {referredBy.id ? (
                        <Link href={`/${lang}/user/${referredBy.id}`} className="text-blue-600 underline hover:text-blue-800">
                          {referredBy.nusuario || '—'}
                        </Link>
                      ) : (referredBy.nusuario || '—')}
                    </p>
                    <p className="break-all">
                      <span className="font-semibold">{t.referrerWallet}:</span>{' '}
                      <span className="font-mono">{referredBy.billetera || '—'}</span>
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-700">
                    {t.enterCode}{' '}
                    <Link href={`/${lang}/profile#referral`} className="text-blue-600 underline">{t.goProfile}</Link>
                  </p>
                )}
              </div>

              {/* Tarjeta 2: Mis referidos (enlace para compartir, totales y listado) */}
              <div id="code" className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-left">
                <h2 className="font-semibold text-gray-800 mb-3">{t.myReferralsTitle}</h2>
                {code ? (
                  <>
                    <p className="text-sm text-gray-600 mb-1">{t.shareLink}</p>
                    <p className="font-mono text-lg font-semibold text-gray-900 mb-3 break-all">
                      https://learn.tg/{lang}/ref/{code}
                    </p>
                    <button
                      onClick={copyCode}
                      className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      {copied ? t.copiedOk : t.copyLink}
                    </button>
                    {stats && (
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-lg bg-white border border-blue-100 p-3">
                          <div className="text-gray-500">{t.referred}</div>
                          <div className="text-lg font-bold text-gray-900">{stats.total}</div>
                        </div>
                        <div className="rounded-lg bg-white border border-blue-100 p-3">
                          <div className="text-gray-500">{t.rewards}</div>
                          <div className="text-lg font-bold text-gray-900">
                            {stats.rewardsUsdt.toFixed(2)} USDT · {stats.rewardsSlearn.toFixed(2)} SLEARN
                          </div>
                        </div>
                      </div>
                    )}
                    {referrals.length > 0 ? (
                      <div className="mt-4">
                        <ul className="space-y-1 text-sm text-gray-700">
                          {referrals.slice(0, 10).map((r, i) => (
                            <li key={i} className="flex justify-between rounded bg-white border border-blue-100 px-3 py-1.5">
                              {r.referredId ? (
                                <Link href={`/${lang}/user/${r.referredId}`} className="text-blue-600 underline hover:text-blue-800">
                                  {r.nusuario || (es ? 'Usuario' : 'User')}
                                </Link>
                              ) : (
                                <span>{r.nusuario || (es ? 'Usuario' : 'User')}</span>
                              )}
                              <span className="text-gray-500">{r.status}</span>
                            </li>
                          ))}
                        </ul>
                        {referrals.length > 10 && (
                          <p className="text-xs text-gray-500 mt-1">
                            {es ? `…y ${referrals.length - 10} más.` : `…and ${referrals.length - 10} more.`}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 mt-4">{t.emptyReferrals}</p>
                    )}
                    {history.length > 0 && (
                      <div className="mt-4">
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">{t.historyTitle}</h3>
                        <ul className="space-y-1 text-sm text-gray-700">
                          {history.slice(0, 8).map((r, i) => (
                            <li key={i} className="flex justify-between rounded bg-white border border-blue-100 px-3 py-1.5">
                              <span>{r.type === 'referral_bonus' ? 'Pastor bonus' : es ? 'Recompensa' : 'Reward'}</span>
                              <span className="font-mono font-medium">
                                {r.amount.toFixed(2)} {r.crypto.toUpperCase()}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-600">{t.loading}</p>
                )}
              </div>
            </div>
          )}

          {address && activated && code ? (
            <div className="mb-2">
              <h2 className="text-lg font-bold text-gray-800 mb-1">{t.promoTitle}</h2>
              <p className="text-sm text-gray-500 mb-4">{t.promoHint}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link
                  href={pastorsHref}
                  className="rounded-xl border border-blue-200 bg-white p-4 text-left hover:bg-blue-50"
                >
                  <div className="font-semibold text-blue-700 mb-1">🙏 {t.invitePastors}</div>
                  <div className="text-xs text-gray-500">{t.invitePastorsHint}</div>
                </Link>
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-green-200 bg-white p-4 text-left hover:bg-green-50"
                >
                  <div className="font-semibold text-green-700 mb-1">💬 {t.inviteWhatsApp}</div>
                  <div className="text-xs text-gray-500">{t.inviteWhatsAppHint}</div>
                </a>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-3">{ctaHint}</p>
              <Link
                href={ctaHref}
                className="inline-block rounded bg-blue-600 px-8 py-3 text-base font-semibold text-white hover:bg-blue-700"
              >
                {ctaLabel}
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
