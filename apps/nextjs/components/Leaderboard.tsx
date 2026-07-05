'use client'

import { useState, useMemo } from 'react'
import { LeaderboardTable, type SortField, type SortOrder } from '@/components/LeaderboardTable'
import { CountryFilter } from '@/components/CountryFilter'
import { MetricsExplanation } from '@/components/MetricsExplanation'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { useApiData } from '@/lib/hooks/useApiData'
import type { LeaderboardRow, LeaderboardResponse } from '@/types/leaderboard'

interface LeaderboardProps {
  initialData?: LeaderboardResponse
  lang?: string
}

export function Leaderboard({ initialData, lang = 'en' }: LeaderboardProps) {
  // State for filters/sorting
  const [sortBy, setSortBy] = useState<SortField>('slearn_balance')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [country, setCountry] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const limit = 50

  const {
    data: apiData,
    isLoading,
    fetchData,
    setData: setApiData,
  } = useApiData<LeaderboardResponse>({
    endpoint: 'leaderboard',
    params: country ? { country, sortBy, sortOrder, page: String(page), limit: String(limit) } : { sortBy, sortOrder, page: String(page), limit: String(limit) },
    initialData,
    autoFetch: !initialData,
    deps: [country, sortBy, sortOrder, page],
  })

  // Destructure data from apiData
  const data = apiData?.data || []
  const countries = apiData?.countries || []
  const pagination = apiData?.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 }
  const rules = apiData?.rules || []
  const totals = apiData?.totals

  // Translation helper
  const t = useMemo(() => createComponentT(lang, {
    en: {
      leaderboard: 'Leaderboard',
      leaderboardDesc: 'Track user contributions and achievements',
    },
    es: {
      leaderboard: 'Tabla de Clasificación',
      leaderboardDesc: 'Sigue las contribuciones y logros de los usuarios',
    },
  }), [lang])

    const handleSortChange = (newSortBy: SortField, newSortOrder: SortOrder) => {
    setSortBy(newSortBy)
    setSortOrder(newSortOrder)
    setPage(1) // Reset to first page when sorting changes
  }

  const handleCountryChange = (newCountry: string | null) => {
    setCountry(newCountry)
    setPage(1) // Reset to first page when country changes
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t('leaderboard')}
          </h1>
          <p className="text-muted-foreground">
            {t('leaderboardDesc')}
          </p>
        </div>
        <CountryFilter
          countries={countries}
          selectedCountry={country}
          onCountryChange={handleCountryChange}
          disabled={isLoading}
          lang={lang}
        />
      </div>

      <LeaderboardTable
        data={data}
        pagination={pagination}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
        onPageChange={handlePageChange}
        isLoading={isLoading}
        lang={lang}
        rules={rules}
        totals={totals}
      />

      <MetricsExplanation lang={lang} />
    </div>
  )
}

export default Leaderboard
