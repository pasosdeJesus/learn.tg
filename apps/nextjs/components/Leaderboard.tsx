'use client'

import { useState, useEffect, useCallback } from 'react'
import { LeaderboardTable, type SortField, type SortOrder } from '@/components/LeaderboardTable'
import { CountryFilter } from '@/components/CountryFilter'
import type { LeaderboardRow, LeaderboardResponse } from '@/types/leaderboard'

interface LeaderboardProps {
  initialData?: LeaderboardResponse
  lang?: string
}

export function Leaderboard({ initialData, lang = 'en' }: LeaderboardProps) {
  // State for data and loading
  const [data, setData] = useState<LeaderboardRow[]>(initialData?.data || [])
  const [countries, setCountries] = useState(initialData?.countries || [])
  const [pagination, setPagination] = useState(initialData?.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 })
  const [isLoading, setIsLoading] = useState(false)

  // State for filters/sorting
  const [sortBy, setSortBy] = useState<SortField>('learningpoints')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [country, setCountry] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const limit = 50 // Fixed limit as per API default

  // Fetch leaderboard data
  const fetchLeaderboard = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('sortBy', sortBy)
      params.append('sortOrder', sortOrder)
      if (country) params.append('country', country)
      params.append('page', page.toString())
      params.append('limit', limit.toString())

      const response = await fetch(`/api/leaderboard?${params.toString()}`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const result: LeaderboardResponse = await response.json()

      setData(result.data)
      setCountries(result.countries)
      setPagination(result.pagination)
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error)
      // Keep existing data
    } finally {
      setIsLoading(false)
    }
  }, [sortBy, sortOrder, country, page, limit])

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
          <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
          <p className="text-muted-foreground">
            Track user contributions and achievements
          </p>
        </div>
        <CountryFilter
          countries={countries}
          selectedCountry={country}
          onCountryChange={handleCountryChange}
          disabled={isLoading}
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
      />

      <div className="text-sm text-muted-foreground">
        <p>
          <strong>Learning Points</strong> are earned by completing courses and guides.
        </p>
        <p>
          <strong>Scholarship (USDT)</strong> is received as educational grants.
        </p>
        <p>
          <strong>UBI (CELO)</strong> is received through universal basic income claims.
        </p>
        <p>
          <strong>Donations (USDT)</strong> are contributions made to support the platform.
        </p>
      </div>
    </div>
  )
}

export default Leaderboard