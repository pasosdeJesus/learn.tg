'use client'

// Transparencia de la campaña (REQ/223): agregados del ledger (total por
// cripto, split campaña/pdJ/cashback, pendiente de reenvío) y últimas
// donaciones con sus opciones. Datos públicos vía
// GET /api/donations/{slug}/transparency.

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { fmtUsd } from './BalanceDisplay'

export interface CampaignTransparencyData {
  slug: string
  name: { en: string; es: string }
  wallet: string
  goalUSD: number
  totals: {
    byCrypto: Record<string, number>
    campaignUSD: number
    pdjUSD: number
    cashbackSlearn: number
    pendingUSD: number
  }
  recent: Array<{
    date?: string
    donorHash?: string
    crypto?: string
    amount?: number
    usd?: number
    pdjSharePct?: number
    receiveCashback?: boolean
    forwardOK: boolean
    comment?: string
    campaignForwardHash?: string
    pdjForwardHash?: string
  }>
}

const fmtAmount = (v?: number) => (v == null ? '--' : v.toLocaleString('en-US', { maximumFractionDigits: 6 }))
const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleString() : '--')

export default function CampaignTransparency({ slug = 'lensenia', lang = 'en' }: { slug?: string; lang?: string }) {
  const [data, setData] = useState<CampaignTransparencyData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const t = useMemo(() => createComponentT(lang, {
    en: {
      title: 'Campaign transparency',
      raisedByToken: 'Donated by token',
      toCampaign: 'To the campaign (USD)',
      toPdJ: 'To pdJ (USD)',
      cashback: 'SLEARN cashback paid',
      pending: 'Pending forward (USD)',
      recent: 'Latest donations',
      forwardOK: 'Forwarded',
      forwardPending: 'Pending forward',
      comment: 'Comment',
      noDonations: 'No donations yet',
      loadFailed: 'Could not load the campaign transparency. Try again later.',
      retry: 'Retry',
    },
    es: {
      title: 'Transparencia de la campaña',
      raisedByToken: 'Donado por token',
      toCampaign: 'A la campaña (USD)',
      toPdJ: 'A pdJ (USD)',
      cashback: 'Cashback SLEARN pagado',
      pending: 'Pendiente de reenvío (USD)',
      recent: 'Últimas donaciones',
      forwardOK: 'Reenviado',
      forwardPending: 'Pendiente de reenvío',
      comment: 'Comentario',
      noDonations: 'Aún no hay donaciones',
      loadFailed: 'No se pudo cargar la transparencia de la campaña. Intenta más tarde.',
      retry: 'Reintentar',
    },
  }), [lang])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/donations/${slug}/transparency`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData((await res.json()) as CampaignTransparencyData)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => { load() }, [load])

  const explorerBase = process.env.NEXT_PUBLIC_NETWORK === 'celo' ? 'https://celo.blockscout.com' : 'https://celo-sepolia.blockscout.com'

  return (
    <div className="rounded-2xl bg-white shadow-md p-4 text-gray-800">
      <h3 className="text-lg font-bold mb-3">
        {t('title')}{data ? ` — ${lang === 'es' ? data.name.es : data.name.en}` : ''}
      </h3>
      {error && (
        <div className="text-sm text-red-600">
          {t('loadFailed')}{' '}
          <button onClick={load} className="underline text-blue-600">{t('retry')}</button>
        </div>
      )}
      {!error && loading && !data && <p className="text-sm text-gray-500">Loading...</p>}
      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg bg-blue-50 p-2">
              <div className="text-xs text-gray-500">{t('raisedByToken')}</div>
              {(Object.entries(data.totals.byCrypto).length
                ? Object.entries(data.totals.byCrypto)
                : [['—', 0] as [string, number]]
              ).map(([c, amt]) => (
                <div key={c} className="font-mono">{c.toUpperCase()}: {fmtAmount(amt)}</div>
              ))}
            </div>
            <div className="rounded-lg bg-green-50 p-2">
              <div className="text-xs text-gray-500">{t('toCampaign')}</div>
              <div className="font-semibold">{fmtUsd(data.totals.campaignUSD)}</div>
            </div>
            <div className="rounded-lg bg-yellow-50 p-2">
              <div className="text-xs text-gray-500">{t('toPdJ')}</div>
              <div className="font-semibold">{fmtUsd(data.totals.pdjUSD)}</div>
            </div>
            <div className="rounded-lg bg-purple-50 p-2">
              <div className="text-xs text-gray-500">{t('cashback')}</div>
              <div className="font-mono">{fmtAmount(data.totals.cashbackSlearn)} SLEARN</div>
            </div>
            <div className="rounded-lg bg-amber-50 p-2">
              <div className="text-xs text-gray-500">{t('pending')}</div>
              <div className="font-semibold">{fmtUsd(data.totals.pendingUSD)}</div>
            </div>
          </div>

          <h4 className="text-sm font-bold uppercase text-gray-500 mt-5 mb-2">{t('recent')}</h4>
          {data.recent.length === 0 ? (
            <p className="text-sm text-gray-500">{t('noDonations')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-1 pr-2">Date</th>
                    <th className="py-1 pr-2">Token</th>
                    <th className="py-1 pr-2 text-right">Amount</th>
                    <th className="py-1 pr-2 text-right">USD</th>
                    <th className="py-1 pr-2 text-right">pdJ %</th>
                    <th className="py-1 pr-2">Cashback</th>
                    <th className="py-1 pr-2">Forward</th>
                    <th className="py-1 pr-2">{t('comment')}</th>
                    <th className="py-1">Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((d, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-1 pr-2 whitespace-nowrap">{fmtDate(d.date)}</td>
                      <td className="py-1 pr-2 font-mono">{d.crypto?.toUpperCase() ?? '--'}</td>
                      <td className="py-1 pr-2 text-right font-mono">{fmtAmount(d.amount)}</td>
                      <td className="py-1 pr-2 text-right">{fmtUsd(d.usd ?? null)}</td>
                      <td className="py-1 pr-2 text-right">{d.pdjSharePct ?? 0}%</td>
                      <td className="py-1 pr-2">{d.receiveCashback ? 'ON' : 'OFF'}</td>
                      <td className="py-1 pr-2">
                        {d.forwardOK
                          ? <span className="text-green-600">{t('forwardOK')}</span>
                          : <span className="text-amber-600">{t('forwardPending')}</span>}
                      </td>
                      <td className="py-1 pr-2 max-w-[16rem]">
                        {d.comment ? <span className="text-gray-500 italic">{d.comment}</span> : '—'}
                      </td>
                      <td className="py-1">
                        {d.donorHash ? (
                          <a href={`${explorerBase}/tx/${d.donorHash}`} target="_blank" rel="noopener noreferrer"
                            className="text-blue-600 underline break-all">
                            {d.donorHash.slice(0, 10)}…
                          </a>
                        ) : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
