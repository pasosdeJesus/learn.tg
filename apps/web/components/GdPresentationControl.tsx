'use client'

// Presentación del clúster a Global Disciples desde la página del curso (R-#161,
// 2026-10-27). El control solo aparece para el **iniciador** del clúster y reutiliza
// `/api/cluster/status` y `/api/cluster/[id]/gd-presentation`; la página del clúster
// muestra la misma información con más detalle.

import { useCallback, useEffect, useState } from 'react'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { createComponentT } from '@/lib/hooks/useTranslation'

type Status = {
  hasCluster?: boolean
  clusterId?: number
  isInitiator?: boolean
}

type Presentation = {
  ready: boolean
  isInitiator: boolean
  request: {
    requested_at: string | null
    sent_at: string | null
    response?: string | null
    contact_email?: string | null
  } | null
  missing: string[]
}

export function GdPresentationControl({ lang }: { lang: string }) {
  const { address } = useAuthAddress()
  const [status, setStatus] = useState<Status | null>(null)
  const [presentation, setPresentation] = useState<Presentation | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const t = createComponentT(lang, {
    en: {
      title: 'Present the cluster to Global Disciples',
      request: 'Request the presentation to Global Disciples',
      send: 'Send request',
      requested: 'Presentation requested',
      sent: 'pdJ wrote to GD',
      response: 'Answer from Global Disciples',
      contact: 'Email or channel to continue',
      ok: 'Request sent to pdJ',
      failed: 'Could not send the request',
      notReady: 'The cluster still has conditions to meet; see the cluster page.',
      details: 'See the conditions',
    },
    es: {
      title: 'Presentar el clúster a Global Disciples',
      request: 'Solicitar la presentación a Global Disciples',
      send: 'Enviar solicitud',
      requested: 'Presentación solicitada',
      sent: 'pdJ escribió a GD',
      response: 'Respuesta de Global Disciples',
      contact: 'Correo o canal para continuar',
      ok: 'Solicitud enviada a pdJ',
      failed: 'No se pudo enviar la solicitud',
      notReady: 'Al clúster le faltan condiciones; mira la página del clúster.',
      details: 'Ver las condiciones',
    },
  })

  const load = useCallback(async () => {
    if (!address) { setStatus(null); setPresentation(null); return }
    try {
      const res = await fetch(`/api/cluster/status?walletAddress=${encodeURIComponent(address)}`)
      if (!res.ok) { setStatus(null); return }
      const data: Status = await res.json()
      setStatus(data)
      if (data.hasCluster && data.clusterId && data.isInitiator) {
        const pr = await fetch(`/api/cluster/${data.clusterId}/gd-presentation?walletAddress=${encodeURIComponent(address)}`)
        setPresentation(pr.ok ? await pr.json() : null)
      } else {
        setPresentation(null)
      }
    } catch {
      setStatus(null)
      setPresentation(null)
    }
  }, [address])

  useEffect(() => { load() }, [load])

  const request = async () => {
    if (!status?.clusterId) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch(`/api/cluster/${status.clusterId}/gd-presentation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address }),
      })
      if (!res.ok) throw new Error(t('failed'))
      setConfirmed(false)
      await load()
    } catch {
      setError(t('failed'))
    } finally {
      setSending(false)
    }
  }

  if (!status?.hasCluster || !status.isInitiator || !status.clusterId) return null

  const clusterHref = `/${lang}/cluster/${status.clusterId}`

  return (
    <div className="mt-4 border-t border-gray-100 pt-3">
      <h4 className="text-sm font-semibold text-gray-700 mb-2">{t('title')}</h4>
      {presentation?.request ? (
        <div className="text-xs text-gray-700 space-y-1">
          <p>
            {t('requested')}
            {presentation.request.requested_at ? ` · ${new Date(presentation.request.requested_at).toLocaleDateString(lang)}` : ''}
          </p>
          {presentation.request.sent_at && (
            <p>{t('sent')}{` · ${new Date(presentation.request.sent_at).toLocaleDateString(lang)}`}</p>
          )}
          {presentation.request.response && (
            <div className="rounded border border-gray-200 bg-gray-50 p-2">
              <p className="font-semibold mb-1">{t('response')}</p>
              <p className="whitespace-pre-wrap">{presentation.request.response}</p>
            </div>
          )}
          {presentation.request.contact_email && (
            <p>{t('contact')}: <code className="font-mono break-all">{presentation.request.contact_email}</code></p>
          )}
        </div>
      ) : presentation ? (
        <div className="flex flex-col gap-2">
          {!presentation.ready && (
            <p className="text-xs text-amber-700">
              {t('notReady')}{' '}
              <a href={clusterHref} className="underline">{t('details')}</a>
            </p>
          )}
          <label className="flex items-start gap-2 text-xs text-gray-700">
            <input type="checkbox" className="mt-0.5" checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)} disabled={!presentation.ready} />
            <span>{t('request')}</span>
          </label>
          <div>
            <button type="button" onClick={request} disabled={!confirmed || !presentation.ready || sending}
              className="rounded bg-primary px-3 py-1.5 text-xs font-semibold text-white! disabled:opacity-50">
              {sending ? '…' : t('send')}
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      ) : null}
    </div>
  )
}
