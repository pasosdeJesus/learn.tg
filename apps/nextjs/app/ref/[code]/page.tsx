'use client'

// Página /ref/{CODE} — captura el código de referido en localStorage y lo
// reclama automáticamente al conectar la wallet (REQ/163 §2.3).
import { useEffect, useState } from 'react'
import { use } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import axios from 'axios'

export default function RefPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const { data: session } = useSession()
  const [status, setStatus] = useState<'stored' | 'claimed' | 'already'>('stored')
  const [es, setEs] = useState(false)

  useEffect(() => {
    const lang = window.location.pathname.split('/')[1] || 'en'
    setEs(lang === 'es')
    const normalized = (code || '').toUpperCase()
    if (!normalized) return
    try { localStorage.setItem('learn.tg.pendingReferralCode', normalized) } catch { /* ignore */ }
  }, [code])

  // Si ya hay sesión, reclama de inmediato
  useEffect(() => {
    if (!session?.address) return
    const pending = localStorage.getItem('learn.tg.pendingReferralCode')
    if (!pending) return
    ;(async () => {
      try {
        const token = localStorage.getItem('learn.tg.authToken')
        const res = await axios.post('/api/referral/claim', {
          walletAddress: session.address,
          token: token || '',
          code: pending,
        })
        if (res.status === 200) {
          localStorage.removeItem('learn.tg.pendingReferralCode')
          setStatus('claimed')
        }
      } catch {
        setStatus('already')
      }
    })()
  }, [session?.address])

  const title = es ? '¡Has sido invitado a learn.tg!' : 'You have been invited to learn.tg!'
  const body = es
    ? 'Tu código de referido fue guardado. Conecta tu wallet para activarlo y ganar recompensas juntos.'
    : 'Your referral code was saved. Connect your wallet to activate it and earn rewards together.'
  const bodyClaimed = es
    ? '¡Código de referido activado! Invita a otros y gana recompensas.'
    : 'Referral code activated! Invite others and earn rewards.'
  const bodyAlready = es
    ? 'Ya habías reclamado un código de referido.'
    : 'You already claimed a referral code.'
  const cta = es ? 'Ir a la página principal' : 'Go to the home page'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-gray-50 to-gray-100 p-4">
      <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-8 md:p-12 max-w-md text-center">
        <div className="text-4xl mb-3">🤝</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">{title}</h1>
        <p className="text-gray-600 mb-6">
          {status === 'claimed' ? bodyClaimed : status === 'already' ? bodyAlready : body}
        </p>
        <Link
          href={es ? '/es' : '/en'}
          className="inline-block rounded bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700"
        >
          {cta}
        </Link>
      </div>
    </div>
  )
}
