'use client'

// Historial de movimientos de la billetera de la campaña (REQ/223): datos
// públicos vía GET /api/donations/{slug}/movements (explorers Celo/Base/Avax).
// Muestra las más recientes (limit) y enlaza al historial completo.

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createComponentT } from '@/lib/hooks/useTranslation'

export interface Movement {
  chain: string
  ts: string
  hash: string
  direction: 'in' | 'out' | 'self'
  kind: 'native' | 'token'
  token: string | null
  amount: number
  method: string | null
  counterparty: string
  counterpartyName: string | null
  contract: boolean
  tag: 'pool' | 'xaut' | null
}

export interface MovementsResponse {
  slug: string
  network?: string
  wallet: string
  chains: Array<{ chain: string; available: boolean; error?: string; count: number }>
  rows: Movement[]
  total: number
  truncated: boolean
}

const CHAIN_LABEL: Record<string, { en: string; es: string }> = {
  celo: { en: 'Celo', es: 'Celo' },
  base: { en: 'Base', es: 'Base' },
  avax: { en: 'Avalanche', es: 'Avalanche' },
}

const explorerFor = (chain: string, hash: string) => {
  const base =
    chain === 'celo' ? 'https://celo.blockscout.com'
      : chain === 'base' ? 'https://base.blockscout.com'
        : 'https://avalanche.blockscout.com'
  return `${base}/tx/${hash}`
}

export default function Movements({
  slug = 'lensenia',
  lang = 'en',
  limit = 8,
  showLink = false,
}: { slug?: string; lang?: string; limit?: number; showLink?: boolean }) {
  const [data, setData] = useState<MovementsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const t = useMemo(() => createComponentT(lang, {
    en: {
      title: 'Recent movements of the campaign wallet',
      fullHistory: 'Full movement history',
      none: 'No movements found yet (or an explorer is temporarily unavailable).',
      retry: 'Retry',
      loadFailed: 'Could not load movements. Try again later.',
      in: 'In', out: 'Out', self: 'Internal',
      token: 'Token', amount: 'Amount', date: 'Date', chain: 'Chain', dir: 'Dir',
      tagPool: 'Pool (invested)', tagXaut: 'XAUt0', tagNone: '—',
      note: 'Transparency note: outflows of this wallet went to smart contracts — e.g. Uniswap pools and the XAUt0 (gold) token — not to personal accounts. Current balances are shown in the balance card. Historical P&L per investment is a future phase.',
      devNote: 'Development site: movements below are the TESTNET ones (Celo Sepolia). The balance card shows the real mainnet wallet.',
    },
    es: {
      title: 'Movimientos recientes de la billetera de la campaña',
      fullHistory: 'Historial completo de movimientos',
      none: 'Aún no hay movimientos (o un explorer está temporalmente no disponible).',
      retry: 'Reintentar',
      loadFailed: 'No se pudieron cargar los movimientos. Intenta más tarde.',
      in: 'Entrada', out: 'Salida', self: 'Interno',
      token: 'Token', amount: 'Monto', date: 'Fecha', chain: 'Cadena', dir: 'Dir.',
      tagPool: 'Piscina (invertido)', tagXaut: 'XAUt0', tagNone: '—',
      note: 'Nota de transparencia: las salidas de esta billetera fueron a contratos inteligentes — p. ej. piscinas Uniswap y el token XAUt0 (oro) — no a cuentas personales. Los saldos actuales se muestran en la tarjeta de balance. El P&L histórico por inversión es una fase futura.',
      devNote: 'Sitio de desarrollo: los movimientos de abajo son los de PRUEBA (Celo Sepolia). La tarjeta de balance muestra la billetera real en mainnet.',
    },
  }), [lang])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/donations/${slug}/movements?limit=${limit}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData((await res.json()) as MovementsResponse)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [slug, limit])

  useEffect(() => { load() }, [load])

  const rows = data?.rows || []
  const isTestnet = data?.network === 'testnet' || process.env.NEXT_PUBLIC_NETWORK !== 'celo'
  return (
    <div className="rounded-2xl bg-white shadow-md p-4 text-gray-800">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold">{t('title')}</h3>
        {isTestnet && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">testnet</span>}
        {showLink && (
          <a href={`/${lang}/donations/${slug}/movements`} className="text-xs text-blue-600 underline">
            {t('fullHistory')}
          </a>
        )}
      </div>
      {error && (
        <p className="text-sm text-red-600 mt-2">
          {t('loadFailed')} <button onClick={load} className="underline text-blue-600">{t('retry')}</button>
        </p>
      )}
      {!error && loading && !data && <p className="text-sm text-gray-500 mt-2">Loading...</p>}
      {data && rows.length === 0 && <p className="text-sm text-gray-500 mt-2">{t('none')}</p>}
      {rows.length > 0 && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-1 pr-2">{t('date')}</th>
                <th className="py-1 pr-2">{t('chain')}</th>
                <th className="py-1 pr-2">{t('dir')}</th>
                <th className="py-1 pr-2">{t('amount')}</th>
                <th className="py-1 pr-2">{t('token')}</th>
                <th className="py-1 pr-2">Detail</th>
                <th className="py-1">Tx</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m, i) => {
                const dir = m.direction === 'out' ? t('out') : m.direction === 'self' ? t('self') : t('in')
                const tag = m.tag === 'pool' ? t('tagPool') : m.tag === 'xaut' ? t('tagXaut') : t('tagNone')
                const label = m.counterpartyName || (m.contract ? m.counterparty.slice(0, 10) + '…' : m.counterparty.slice(0, 10) + '…')
                return (
                  <tr key={`${m.chain}-${m.hash}-${i}`} className="border-b border-gray-100">
                    <td className="py-1 pr-2 whitespace-nowrap">{m.ts ? new Date(m.ts).toLocaleDateString() : '--'}</td>
                    <td className="py-1 pr-2">{CHAIN_LABEL[m.chain]?.[lang === 'es' ? 'es' : 'en'] || m.chain}</td>
                    <td className="py-1 pr-2 font-semibold">
                      <span className={m.direction === 'in' ? 'text-green-600' : m.direction === 'out' ? 'text-red-500' : 'text-gray-500'}>
                        {dir}
                      </span>
                    </td>
                    <td className="py-1 pr-2 text-right font-mono">{m.amount.toLocaleString('en-US', { maximumFractionDigits: 6 })}</td>
                    <td className="py-1 pr-2 font-mono">{m.token || (m.kind === 'native' ? 'CELO' : '--')}</td>
                    <td className="py-1 pr-2">
                      <span className="font-medium">{tag}</span>
                      {m.counterparty && <span className="block text-gray-400 truncate max-w-[12rem]">{label}</span>}
                    </td>
                    <td className="py-1">
                      {m.hash ? (
                        <a href={explorerFor(m.chain, m.hash)} target="_blank" rel="noopener noreferrer"
                          className="text-blue-600 underline break-all">{m.hash.slice(0, 10)}…</a>
                      ) : '--'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {isTestnet && <p className="mt-3 text-xs text-amber-600">{t('devNote')}</p>}
      <p className="mt-1 text-xs text-gray-500">{t('note')}</p>
    </div>
  )
}
