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
  const rules = apiData?.rules || []

  // Translation helper
  const t = useMemo(() => createComponentT(lang, {
    en: {
      transparency: 'Transparency',
      transparencyDesc: 'Platform totals by country',
      viewLeaderboard: 'View Leaderboard',
    },
    es: {
      transparency: 'Transparencia',
      transparencyDesc: 'Totales de la plataforma por país',
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