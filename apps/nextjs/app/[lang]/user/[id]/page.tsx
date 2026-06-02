'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { Loader2, Lock, Star, ExternalLink, Share2, Trophy } from 'lucide-react'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { IS_PRODUCTION } from '@/lib/config'

type PageProps = {
  params: Promise<{ lang: string; id: string }>
}

interface ProfileData {
  id: number
  name: string
  learningscore: number | null
  slearn_balance: number | null
  profilescore: number | null
  memberSince: string
  wallets: { address: string; addedAt: string }[]
  credentials: {
    tokenId: number
    courseName: string
    courseLang: string
    earnedAt: string
    isPremium: boolean
    hash: string
    imageUrl: string
  }[]
  transactions: {
    totalCount: number
    totalEarned: string
    recent: { hash: string; amount: string; date: string; type: string; crypto: string }[]
  }
  leaderboardRank: number | null
}

export default function PublicProfilePage({ params }: PageProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lang, setId] = useState<{ lang: string; id: string } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => { params.then(p => setId(p)) }, [params])

  const locale = lang?.lang === 'en' ? 'en' : 'es'
  const t = useMemo(() => createComponentT(locale, {
    en: {
      loading: 'Loading profile...',
      error: 'Error: ',
      notFound: 'User not found',
      memberSince: 'Member since',
      learningScore: 'Learning Score',
      slearnBalance: 'SLEARN Balance',
      profileScore: 'Profile Score',
      wallets: 'Wallets',
      credentials: 'Course Credentials',
      noCredentials: 'No credentials earned yet.',
      premium: 'Premium',
      free: 'Free',
      soulbound: 'Soulbound',
      transactions: 'Recent Transactions',
      noTransactions: 'No transactions yet.',
      totalEarned: 'Total earned',
      viewAll: 'View all',
      leaderboard: 'Leaderboard',
      rank: 'Rank',
      share: 'Share',
      copied: 'Link copied!',
      txType: 'Type',
      txAmount: 'Amount',
      txDate: 'Date',
      celoScan: 'Explorer',
    },
    es: {
      loading: 'Cargando perfil...',
      error: 'Error: ',
      notFound: 'Usuario no encontrado',
      memberSince: 'Miembro desde',
      learningScore: 'Puntaje de Aprendizaje',
      slearnBalance: 'Saldo SLEARN',
      profileScore: 'Puntaje de Perfil',
      wallets: 'Billeteras',
      credentials: 'Credenciales de Cursos',
      noCredentials: 'Sin credenciales aún.',
      premium: 'Premium',
      free: 'Gratis',
      soulbound: 'Intransferible',
      transactions: 'Transacciones Recientes',
      noTransactions: 'Sin transacciones aún.',
      totalEarned: 'Total ganado',
      viewAll: 'Ver todas',
      leaderboard: 'Tabla de Posiciones',
      rank: 'Puesto',
      share: 'Compartir',
      copied: '¡Enlace copiado!',
      txType: 'Tipo',
      txAmount: 'Monto',
      txDate: 'Fecha',
      celoScan: 'Explorer',
    },
  }), [locale])

  useEffect(() => {
    if (!lang) return
    const userId = lang.id
    fetch(`/api/user/${userId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); setLoading(false); return }
        setProfile(data)
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [lang])

  if (!lang) return null

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        <span className="ml-2 text-gray-500">{t('loading')}</span>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="max-w-2xl mx-auto p-10 text-center">
        <h1 className="text-xl font-semibold text-red-600">
          {t('error')}{error || t('notFound')}
        </h1>
      </div>
    )
  }

  const memberSince = new Date(profile.memberSince).toLocaleDateString(
    locale === 'es' ? 'es-CO' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' }
  )

  const formatDate = (d: string) => new Date(d).toLocaleDateString(
    locale === 'es' ? 'es-CO' : 'en-US',
    { year: 'numeric', month: 'short', day: 'numeric' }
  )

  const handleShare = async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const input = document.createElement('input')
      input.value = url
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const cryptoLabel = (c: string) => c === 'learningpoints' ? 'LP' : c === 'slearn' ? 'SLEARN' : c === 'usdt' ? 'USDT' : c === 'celo' ? 'CELO' : c.toUpperCase()

  const explorerBase = IS_PRODUCTION ? 'https://celo.blockscout.com' : 'https://celo-sepolia.blockscout.com'

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{profile.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('memberSince')}: {memberSince}
          </p>
        </div>
        <div className="flex gap-2 mt-3 sm:mt-0">
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <Share2 className="h-4 w-4" />
            {copied ? t('copied') : t('share')}
          </button>
        </div>
      </div>

      {/* Scores */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{profile.slearn_balance ?? 0}</p>
          <p className="text-xs text-gray-500 mt-1">{t('slearnBalance')}</p>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">{profile.profilescore ?? 0}</p>
          <p className="text-xs text-gray-500 mt-1">{t('profileScore')}</p>
        </div>
        {profile.leaderboardRank && (
          <div className="bg-white rounded-xl border p-4 text-center">
            <div className="inline-flex items-center gap-1">
              <Trophy className="h-5 w-5 text-amber-500" />
              <p className="text-2xl font-bold text-amber-600">#{profile.leaderboardRank}</p>
            </div>
            <p className="text-xs text-gray-500 mt-1">{t('rank')}</p>
          </div>
        )}
      </div>

      {/* Wallets */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">{t('wallets')}</h2>
        <div className="space-y-2">
          {profile.wallets.map((w, i) => (
            <div key={i} className="bg-white rounded-lg border p-3 flex items-center justify-between">
              <code className="text-sm text-gray-700 font-mono">{w.address}</code>
              <a
                href={`${explorerBase}/address/${w.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
              >
                {t('celoScan')} <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Credentials */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">{t('credentials')}</h2>
        {profile.credentials.length === 0 ? (
          <p className="text-sm text-gray-500 italic">{t('noCredentials')}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {profile.credentials.map((c, i) => (
              <div key={i} className="bg-white rounded-lg border p-4 flex items-start gap-3">
                <img
                  src={`/${c.imageUrl}`}
                  alt={c.courseName}
                  className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-medium text-gray-900 truncate">{c.courseName}</h3>
                    {c.isPremium && <Star className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />}
                    <Lock className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatDate(c.earnedAt)}
                    <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                      {c.isPremium ? t('premium') : t('free')}
                    </span>
                  </p>
                  {c.hash && (
                    <a
                      href={`${explorerBase}/tx/${c.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-1"
                    >
                      {t('celoScan')} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Transactions */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">{t('transactions')}</h2>
          <Link
            href={`/${lang.lang}/user-transactions/${lang.id}`}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {t('viewAll')} →
          </Link>
        </div>
        {profile.transactions.totalCount > 0 && (
          <p className="text-sm text-gray-600 mb-3">
            {profile.transactions.totalCount} tx
          </p>
        )}
        {profile.transactions.recent.length === 0 ? (
          <p className="text-sm text-gray-500 italic">{t('noTransactions')}</p>
        ) : (
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-2">{t('txType')}</th>
                  <th className="px-4 py-2">{t('txAmount')}</th>
                  <th className="px-4 py-2 hidden sm:table-cell">{t('txDate')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {profile.transactions.recent.map((tx, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-700">{tx.type}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">
                      <span className={Number(tx.amount) >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {Number(tx.amount).toFixed(2)} {cryptoLabel(tx.crypto)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 hidden sm:table-cell">
                      {formatDate(tx.date)}
                      {tx.hash && (
                        <a
                          href={`${explorerBase}/tx/${tx.hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 text-blue-600 hover:text-blue-800"
                        >
                          <ExternalLink className="h-3 w-3 inline" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
