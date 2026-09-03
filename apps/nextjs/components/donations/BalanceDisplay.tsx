'use client'

// Balance multi-cadena de la campaña (REQ/223 §4.1 presentación):
// lee GET /api/donations/{slug}/balance (saldos on-chain de la billetera
// destino en Celo, AVAX y Base, incluye ahorros previos).

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createComponentT } from '@/lib/hooks/useTranslation'
import ProgressBar from './ProgressBar'

export interface BalanceEntry {
  key: string
  symbol: string
  amount: number
  decimals: number
  usd: number | null
}

export interface BalanceChain {
  chain: string
  chainId: number
  available: boolean
  error?: string
  native?: BalanceEntry | null
  tokens: BalanceEntry[]
  totalUSD: number | null
}

export interface CampaignBalance {
  slug: string
  name: { en: string; es: string }
  wallet: string
  goalUSD: number
  totalUSD: number | null
  pendingUSD: number
  chains: BalanceChain[]
  updatedAt: string
}

const CHAIN_LABEL: Record<string, { en: string; es: string }> = {
  celo: { en: 'Celo', es: 'Celo' },
  avax: { en: 'Avalanche', es: 'Avalanche' },
  base: { en: 'Base', es: 'Base' },
}

export function fmtUsd(v: number | null): string {
  return v != null ? `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '--'
}

export default function BalanceDisplay({ slug = 'lensenia', lang = 'en' }: { slug?: string; lang?: string }) {
  const [data, setData] = useState<CampaignBalance | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const t = useMemo(() => createComponentT(lang, {
    en: {
      raised: 'Total raised (wallet, all chains)',
      pending: 'Pending forward (auto-relay queue)',
      goal: 'Goal',
      perChain: 'Funds by chain',
      unavailable: 'Unavailable',
      loadFailed: 'Could not load the balance. Try again later.',
      retry: 'Retry',
      updated: 'Updated',
      shortWallet: 'Destination wallet',
    },
    es: {
      raised: 'Total recaudado (billetera, todas las cadenas)',
      pending: 'Pendiente de reenvío (cola de reenvío automático)',
      goal: 'Meta',
      perChain: 'Fondos por cadena',
      unavailable: 'No disponible',
      loadFailed: 'No se pudo cargar el balance. Intenta más tarde.',
      retry: 'Reintentar',
      updated: 'Actualizado',
      shortWallet: 'Billetera destino',
    },
  }), [lang])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/donations/${slug}/balance`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as CampaignBalance
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => { load() }, [load])

  const entries = (chain: BalanceChain) => [
    ...(chain.native ? [chain.native] : []),
    ...chain.tokens,
  ]

  return (
    <div className="rounded-2xl bg-white shadow-md p-4 text-gray-800">
      {error && (
        <div className="text-sm text-red-600 mb-3">
          {t('loadFailed')}{' '}
          <button onClick={load} className="underline text-blue-600">{t('retry')}</button>
        </div>
      )}
      {!error && loading && !data && <p className="text-sm text-gray-500">Loading...</p>}
      {data && (
        <>
          <div className="flex justify-between items-baseline">
            <p className="text-sm font-bold">{t('raised')}</p>
            <p className="text-2xl font-extrabold text-blue-700">{fmtUsd(data.totalUSD)}</p>
          </div>
          {data.pendingUSD > 0 && (
            <p className="text-xs text-amber-600 mt-1">{t('pending')}: {fmtUsd(data.pendingUSD)}</p>
          )}
          <div className="mt-3">
            <ProgressBar raisedUSD={data.totalUSD} goalUSD={data.goalUSD} />
          </div>
          <p className="text-xs text-gray-400 mt-1 break-all">
            {t('shortWallet')}: {data.wallet}
          </p>

          <div className="mt-4">
            <p className="text-xs font-bold uppercase text-gray-500 mb-2">{t('perChain')}</p>
            <div className="space-y-3">
              {data.chains.map((chain) => (
                <div key={chain.chain} className="border border-gray-100 rounded-lg p-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">
                      {CHAIN_LABEL[chain.chain]?.[lang === 'es' ? 'es' : 'en'] || chain.chain}
                    </span>
                    {chain.available
                      ? <span className="font-semibold">{fmtUsd(chain.totalUSD)}</span>
                      : <span className="text-red-500 text-xs">{t('unavailable')}</span>}
                  </div>
                  {chain.available ? (
                    <ul className="mt-1 text-xs text-gray-600 space-y-0.5">
                      {entries(chain).map((entry) => (
                        <li key={entry.key} className="flex justify-between">
                          <span className="font-mono">
                            {entry.symbol}: {entry.amount.toLocaleString('en-US', { maximumFractionDigits: 6 })}
                          </span>
                          <span>{fmtUsd(entry.usd)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-red-400">{chain.error || t('unavailable')}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
