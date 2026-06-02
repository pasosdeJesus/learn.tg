'use client'

import { useCallback, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@pasosdejesus/m/shadcn-components/ui/button'
import { TransparencyTable } from '@/components/TransparencyTable'
import { MetricsExplanation } from '@/components/MetricsExplanation'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { useApiData } from '@/lib/hooks/useApiData'
import type { CountryTotals, TransparencyResponse } from '@/types/leaderboard'

interface TransparencyProps {
  initialData?: TransparencyResponse
  lang?: string
}

export function Transparency({ initialData, lang = 'en' }: TransparencyProps) {
  // State for data and loading
  const {
    data: apiData,
    isLoading,
    fetchData,
    setData: setApiData,
  } = useApiData<TransparencyResponse>({
    endpoint: 'transparency',
    initialData,
    autoFetch: !initialData,
  })

  // Destructure data from apiData
  const data = apiData?.data || []
  const totals = apiData?.totals
  const reserves = apiData?.reserves
  const rules = apiData?.rules || []

  // Translation helper
  const t = useMemo(() => createComponentT(lang, {
    en: {
      transparency: 'Transparency',
      transparencyDesc: 'Platform totals by country',
      reserves: 'SLEARN Reserves',
      slearnSupply: 'Total SLEARN',
      learnTgReserve: 'Hot Reserve (L2)',
      stableSlReserve: 'Stable-sl Reserve (S2)',
      reserveMultisig: 'Master Reserve (SL0)',
      referralWallet: 'Referral Wallet',
      churchesWallet: 'Churches Wallet',
      coverage: 'Coverage',
      coverageTarget: 'Target: 120%',
      viewLeaderboard: 'View Leaderboard',
    },
    es: {
      transparency: 'Transparencia',
      transparencyDesc: 'Totales de la plataforma por país',
      reserves: 'Reservas SLEARN',
      slearnSupply: 'Total SLEARN',
      learnTgReserve: 'Reserva Caliente (L2)',
      stableSlReserve: 'Reserva Stable-sl (S2)',
      reserveMultisig: 'Reserva Maestra (SL0)',
      referralWallet: 'Billetera de Referidos',
      churchesWallet: 'Billetera de Iglesias',
      coverage: 'Cobertura',
      coverageTarget: 'Meta: 120%',
      viewLeaderboard: 'Ver Tabla de Clasificación',
    },
  }), [lang])

  // Fetch transparency data
  const fetchTransparency = useCallback(async () => {
    try {
      await fetchData()
    } catch (error) {
      console.error('Failed to fetch transparency data:', error)
      // Error is already handled by useApiData
    }
  }, [fetchData])

  // Initial fetch if no initialData provided
  useEffect(() => {
    if (!initialData) {
      fetchTransparency()
    }
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t('transparency')}
          </h1>
          <p className="text-muted-foreground">
            {t('transparencyDesc')}
          </p>
        </div>
        <Link href={`/${lang}/leaderboard`}>
          <Button variant="outline" size="sm">
            {t('viewLeaderboard')}
          </Button>
        </Link>
      </div>

      {reserves && (
        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">{t('reserves')}</h2>
          <div className="flex items-center gap-4 mb-4 p-4 rounded-lg bg-muted/50">
            <div>
              <div className="text-sm text-muted-foreground">{t('coverage')}</div>
              <div className={`text-2xl font-bold ${reserves.coverageRatio >= 120 ? 'text-emerald-600' : reserves.coverageRatio >= 100 ? 'text-amber-600' : 'text-red-600'}`}>
                {reserves.coverageRatio}%
              </div>
              <div className="text-xs text-muted-foreground">{t('coverageTarget')}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-3 rounded-md border bg-muted/30">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">{t('slearnSupply')}</div>
              <div className="text-xl font-bold">{reserves.slearnTotalSupply.toLocaleString()}</div>
            </div>
            <div className="p-3 rounded-md border bg-muted/30">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">{t('learnTgReserve')}</div>
              <div className="text-xl font-bold text-emerald-600">${reserves.learnTgReserveUSDT.toFixed(2)}</div>
            </div>
            <div className="p-3 rounded-md border bg-muted/30">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">{t('stableSlReserve')}</div>
              <div className="text-xl font-bold text-emerald-600">${reserves.stableSlReserveUSDT.toFixed(2)}</div>
            </div>
            <div className="p-3 rounded-md border bg-muted/30">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">{t('reserveMultisig')}</div>
              <div className="text-xl font-bold text-amber-600">${reserves.reserveMultisigUSDT.toFixed(2)}</div>
            </div>
            <div className="p-3 rounded-md border bg-muted/30">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">{t('referralWallet')}</div>
              <div className="text-xl font-bold">${reserves.referralWalletUSDT.toFixed(2)}</div>
            </div>
            <div className="p-3 rounded-md border bg-muted/30">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">{t('churchesWallet')}</div>
              <div className="text-xl font-bold">${reserves.churchesWalletUSDT.toFixed(2)}</div>
            </div>
          </div>
        </div>
      )}

      <TransparencyTable
        data={data}
        isLoading={isLoading}
        lang={lang}
        rules={rules}
        totals={totals}
      />

      <MetricsExplanation lang={lang} />
    </div>
  )
}

export default Transparency