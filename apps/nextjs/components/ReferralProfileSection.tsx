'use client'

// Sección de referidos en el perfil (REQ/163): si el usuario no tiene
// referidor puede ingresar el código de quien lo invitó UNA vez; después solo
// ve quién lo refirió (sin editar).
import { useEffect, useState } from 'react'
import axios from 'axios'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'

interface ReferralProfileSectionProps {
  lang: string
}

export function ReferralProfileSection({ lang }: ReferralProfileSectionProps) {
  const { address } = useAuthAddress()
  const es = lang === 'es'
  const [referredBy, setReferredBy] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    if (!address) return
    let cancelled = false
    const token = localStorage.getItem('learn.tg.authToken')
    ;(async () => {
      try {
        const res = await axios.get(`/api/referral/code?walletAddress=${encodeURIComponent(address)}&token=${encodeURIComponent(token || '')}`)
        if (!cancelled) setReferredBy(res.data?.referredBy ?? null)
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [address])

  if (!address) return null

  const submit = async () => {
    setError(null)
    if (!code.trim()) { setError(es ? 'Ingresa el código de tu referidor.' : 'Enter your referrer\'s code.'); return }
    setBusy(true)
    try {
      const token = localStorage.getItem('learn.tg.authToken')
      const res = await axios.post('/api/referral/claim', {
        walletAddress: address, token: token || '', code: code.trim(),
      })
      if (res.status === 200) {
        const ref = await axios.get(`/api/referral/code?walletAddress=${encodeURIComponent(address)}&token=${encodeURIComponent(token || '')}`)
        setReferredBy(ref.data?.referredBy ?? null)
        setOk(true)
        setCode('')
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || (es ? 'No se pudo reclamar el código.' : 'Could not claim the code.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 text-sm">
      <h3 className="text-base font-semibold text-gray-800 mb-2">
        {es ? 'Referidos' : 'Referrals'}
      </h3>
      {referredBy ? (
        <p className="text-gray-700">
          {es ? 'Te refirió' : 'You were referred by'}: <span className="font-semibold">{referredBy}</span>
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-gray-600">
            {es
              ? 'Si alguien te invitó, ingresa su código de referido (solo puede hacerse una vez).'
              : 'If someone invited you, enter their referral code (this can only be done once).'}
          </p>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={es ? 'Código de referido' : 'Referral code'}
              className="w-full max-w-xs rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring focus:border-gray-400"
            />
            <button
              onClick={submit}
              disabled={busy}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? (es ? 'Guardando…' : 'Saving…') : es ? 'Guardar' : 'Save'}
            </button>
          </div>
          {error && <p className="text-red-600 text-xs">{error}</p>}
          {ok && <p className="text-green-700 text-xs">{es ? '¡Código reclamado correctamente!' : 'Code claimed successfully!'}</p>}
        </div>
      )}
    </div>
  )
}
