'use client'

import { useState } from 'react'
import { LeaderboardTable, type SortField, type SortOrder } from '@/components/LeaderboardTable'
import { CountryFilter } from '@/components/CountryFilter'
import { MetricsExplanation } from '@/components/MetricsExplanation'
import { useTranslation } from '@/lib/hooks/useTranslation'
import { useApiData } from '@/lib/hooks/useApiData'
import type { LeaderboardRow, LeaderboardResponse } from '@/types/leaderboard'

interface LeaderboardProps {
  initialData?: LeaderboardResponse
  lang?: string
}

export function Leaderboard({ initialData, lang = 'en' }: LeaderboardProps) {
  const {
    data: apiData,
    isLoading,
    fetchData,
    setData: setApiData,
  } = useApiData<LeaderboardResponse>({
    endpoint: 'leaderboard',
    initialData,
    autoFetch: !initialData,
  })

  // Destructure data from apiData
  const data = apiData?.data || []
  const countries = apiData?.countries || []
  const pagination = apiData?.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 }
  const rules = apiData?.rules || []
  const totals = apiData?.totals

  // State for filters/sorting
  const [sortBy, setSortBy] = useState<SortField>('learningpoints')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [country, setCountry] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const limit = 50 // Fixed limit as per API default

  // Translation helper
  const t = useTranslation(lang)

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
            {t('Leaderboard', 'Tabla de Clasificación')}
          </h1>
          <p className="text-muted-foreground">
            {t('Track user contributions and achievements', 'Sigue las contribuciones y logros de los usuarios')}
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

      <MetricsExplanation t={t} />
    </div>
  )
}

export default Leaderboard
