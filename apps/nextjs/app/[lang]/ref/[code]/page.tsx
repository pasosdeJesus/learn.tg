'use client'

// Página /[lang]/ref/{CODE} — captura el código de referido en localStorage y
// lo reclama automáticamente al conectar la wallet (REQ/163 §2.3).
//
// - Valida el código contra la DB (/api/referral/lookup): si no existe muestra
//   "El código de referido no existe" en vez de la invitación genérica.
// - Si es válido, muestra quién invitó ("Fuiste invitado por {nusuario}").
// - CTA según estado: Connect Wallet (si hay billetera y no hay sesión) o
//   invitación a instalar una billetera con enlace al curso Web3 & UBI.
// - /ref/{CODE} (legacy) redirige aquí con el idioma del navegador.
import { useEffect, useState } from 'react'
import { use } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import axios from 'axios'
import { ConnectWalletButton } from '@/components/ConnectWalletButton'

export default function RefPage({ params }: { params: Promise<{ lang: string; code: string }> }) {
  const { lang, code } = use(params)
  const es = lang === 'es'
  const { data: session } = useSession()
  const [lookup, setLookup] = useState<'loading' | 'valid' | 'invalid' | 'error'>('loading')
  const [inviter, setInviter] = useState<{ nusuario: string | null; nombre: string | null } | null>(null)
  const [hasWallet, setHasWallet] = useState(false)
  const [status, setStatus] = useState<'stored' | 'claimed' | 'already'>('stored')
  const [copied, setCopied] = useState(false)

  // Puente navegador normal → navegador de la billetera: el portapapeles del
  // sistema sí sobrevive al cambio de app. Copiar el enlace (con el código en
  // la URL) y pegarlo en el navegador de la billetera recaptura el código allí.
  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch { /* clipboard unavailable */ }
  }

  // Móvil (lo más común en Sierra Leone): en el navegador normal no hay
  // window.ethereum. MetaMask tiene universal link documentado para abrir una
  // URL en su navegador integrado: https://metamask.app.link/d/<url>.
  const isMobile = typeof navigator !== 'undefined' &&
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  const metaMaskDeepLink = typeof window !== 'undefined' && isMobile
    ? `https://metamask.app.link/d/${encodeURIComponent(window.location.href)}`
    : null

  useEffect(() => {
    const normalized = (code || '').toUpperCase()
    let cancelled = false
    ;(async () => {
      try {
        const res = await axios.get(`/api/referral/lookup?code=${encodeURIComponent(normalized)}`)
        if (cancelled) return
        if (res.data?.valid) {
          setInviter({ nusuario: res.data.nusuario, nombre: res.data.nombre })
          setLookup('valid')
          try { localStorage.setItem('learn.tg.pendingReferralCode', normalized) } catch { /* ignore */ }
        } else {
          setLookup('invalid')
        }
      } catch {
        if (!cancelled) setLookup('error')
      }
    })()
    return () => { cancelled = true }
  }, [code])

  // ¿El navegador tiene una billetera instalada?
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) setHasWallet(true)
  }, [])

  // Si ya hay sesión, reclama de inmediato
  useEffect(() => {
    if (lookup !== 'valid' || !session?.address) return
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
  }, [lookup, session?.address])

  const t = {
    invalidTitle: es ? 'El código de referido no existe' : 'Referral code not found',
    invalidBody: es
      ? 'Verifica el enlace de invitación o conéctate y más adelante podrás agregar a quien te refirió desde tu perfil.'
      : 'Check the invitation link, or connect and later you can add who referred you from your profile.',
    goProfile: es ? 'Ir a mi perfil' : 'Go to my profile',
    goHome: es ? 'Ir al inicio' : 'Go to home',
    title: es ? '¡Has sido invitado a learn.tg!' : 'You have been invited to learn.tg!',
    invitedBy: es ? 'Fuiste invitado por' : 'You were invited by',
    body: es
      ? 'Tu código de referido fue guardado. Conecta tu wallet para activarlo y ganar recompensas juntos.'
      : 'Your referral code was saved. Connect your wallet to activate it and earn rewards together.',
    bodyClaimed: es
      ? '¡Código de referido activado! Invita a otros y gana recompensas.'
      : 'Referral code activated! Invite others and earn rewards.',
    bodyAlready: es
      ? 'Ya habías reclamado un código de referido.'
      : 'You already claimed a referral code.',
    activating: es ? 'Activando tu código…' : 'Activating your code…',
    noWalletTitle: es ? 'Necesitas una billetera' : 'You need a wallet',
    noWalletBody: es
      ? 'Para unirte y recibir recompensas necesitas una billetera de criptomonedas. Aprende a crear la tuya en el curso Web3 & UBI (Guía 2).'
      : 'To join and receive rewards you need a crypto wallet. Learn how to create yours in the Web3 & UBI course (Guide 2).',
    openInMetaMask: es ? 'Abrir en MetaMask' : 'Open in MetaMask',
    // Puente con portapapeles (navegador normal → navegador de la billetera)
    copyBridge: es
      ? '¿Ya tienes una billetera (Rabby, MetaMask u OKX)? Copia este enlace y pégalo en el navegador de tu billetera para conectar y reclamar tu código.'
      : 'Already have a wallet app (Rabby, MetaMask, or OKX)? Copy this link and paste it into your wallet\u2019s browser to connect and claim your code.',
    copyLink: es ? 'Copiar enlace' : 'Copy link',
    copiedOk: es ? '¡Enlace copiado!' : 'Link copied!',
    goCourse: es ? 'Ir al curso Web3 & UBI' : 'Go to the Web3 & UBI course',
    loading: es ? 'Verificando tu invitación…' : 'Checking your invitation…',
    error: es ? 'No se pudo verificar el código. Inténtalo de nuevo.' : 'Could not verify the code. Please try again.',
  }
  const courseHref = es ? `/${lang}/web3-e-ibu/guia2` : `/${lang}/web3-and-ubi/guide2`
  // El enlace al curso conserva el código (?ref=) para que, si el usuario lo
  // abre después en otro navegador (p.ej. el de su billetera web3, con otro
  // localStorage), la página lo vuelva a guardar y el claim siga funcionando.
  const courseRefHref = lookup === 'valid' && code
    ? `${courseHref}?ref=${(code || '').toUpperCase()}`
    : courseHref

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-gray-50 to-gray-100 p-4">
      <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-8 md:p-12 max-w-md text-center">
        {lookup === 'loading' && (
          <>
            <div className="text-4xl mb-3">🤝</div>
            <p className="text-gray-600">{t.loading}</p>
          </>
        )}

        {lookup === 'invalid' && (
          <>
            <div className="text-4xl mb-3">❓</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">{t.invalidTitle}</h1>
            <p className="text-gray-600 mb-6">{t.invalidBody}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href={`/${lang}/profile`} className="inline-block rounded bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700">
                {t.goProfile}
              </Link>
              <Link href={`/${lang}`} className="inline-block rounded border border-gray-300 px-6 py-3 text-base font-medium text-gray-700 hover:bg-gray-50">
                {t.goHome}
              </Link>
            </div>
          </>
        )}

        {lookup === 'error' && (
          <>
            <div className="text-4xl mb-3">⚠️</div>
            <p className="text-gray-600">{t.error}</p>
          </>
        )}

        {lookup === 'valid' && (
          <>
            <div className="text-4xl mb-3">🤝</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">{t.title}</h1>
            {inviter?.nusuario && (
              <p className="text-gray-700 mb-2">
                <span className="font-semibold">{t.invitedBy}:</span> {inviter.nusuario}
              </p>
            )}
            {!session?.address ? (
              <>
                <p className="text-gray-600 mb-6">{t.body}</p>
                {hasWallet ? (
                  <div className="flex justify-center mb-6">
                    <ConnectWalletButton lang={lang} />
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-left">
                    <h2 className="font-semibold text-gray-800 mb-1">{t.noWalletTitle}</h2>
                    <p className="text-sm text-gray-700 mb-3">{t.noWalletBody}</p>
                    <p className="text-sm text-gray-700 mb-2">{t.copyBridge}</p>
                    <button
                      onClick={copyInviteLink}
                      className="inline-block rounded bg-gray-800 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900 mb-3"
                    >
                      {copied ? t.copiedOk : t.copyLink}
                    </button>
                    {metaMaskDeepLink && (
                      <a
                        href={metaMaskDeepLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block rounded bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 mb-3 ml-2"
                      >
                        {t.openInMetaMask}
                      </a>
                    )}
                    <div>
                      <Link href={courseRefHref} className="inline-block rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                        {t.goCourse}
                      </Link>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-gray-600 mb-6">
                  {status === 'claimed' ? t.bodyClaimed : status === 'already' ? t.bodyAlready : t.activating}
                </p>
                <Link href={`/${lang}/profile`} className="inline-block rounded bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700">
                  {t.goProfile}
                </Link>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
