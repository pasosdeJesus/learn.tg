'use client'

import { useState, useEffect, useCallback } from 'react'
import { LeaderboardTable, type SortField, type SortOrder } from '@/components/LeaderboardTable'
import { CountryFilter } from '@/components/CountryFilter'
import { MetricsExplanation } from '@/components/MetricsExplanation'
import { useTranslation } from '@/lib/hooks/useTranslation'
import { useApiData } from '@/lib/hooks/useApiData'
import { buildParamsWithSession } from '@/lib/fetchHelpers'
import type { LeaderboardRow, LeaderboardResponse } from '@/types/leaderboard'

interface LeaderboardProps {
  initialData?: LeaderboardResponse
  lang?: string
}

export function Leaderboard({ initialData, lang = 'en' }: LeaderboardProps) {
  // State for data and loading
  const {
    data: apiData,
    isLoading,
    fetchData,
    setData: setApiData,
  } = useApiData<LeaderboardResponse>({
    endpoint: 'leaderboard',
    initialData,
    autoFetch: false, // We'll handle fetching manually
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

  // Fetch leaderboard data
  const fetchLeaderboard = useCallback(async () => {
    const baseParams: Record<string, string> = {
      sortBy,
      sortOrder,
      page: page.toString(),
      limit: limit.toString(),
    }
    if (country) baseParams.country = country

    try {
      await fetchData(baseParams)
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error)
      // Error is already handled by useApiData
    }
  }, [sortBy, sortOrder, country, page, limit, fetchData])

  // Initial fetch if no initialData provided
  useEffect(() => {
    if (!initialData) {
      fetchLeaderboard()
    }
  }, [])

  // Fetch when filters change
  useEffect(() => {
    if (initialData) {
      // If we had initialData, we need to fetch fresh data when filters change
      fetchLeaderboard()
    } else {
      // Otherwise, fetchLeaderboard already runs on mount
      // We need to run it on filter changes too
      const timeoutId = setTimeout(fetchLeaderboard, 300) // debounce
      return () => clearTimeout(timeoutId)
    }
  }, [sortBy, sortOrder, country, page, fetchLeaderboard])

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
