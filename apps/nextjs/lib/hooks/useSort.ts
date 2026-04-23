import { useState, useCallback } from 'react'

export type SortOrder = 'asc' | 'desc'

export function useSort<T extends string>(defaultSortBy: T, defaultSortOrder: SortOrder = 'desc') {
  const [sortBy, setSortBy] = useState<T>(defaultSortBy)
  const [sortOrder, setSortOrder] = useState<SortOrder>(defaultSortOrder)

  const handleSort = useCallback((field: T) => {
    if (sortBy === field) {
      // Toggle order if same field
      setSortOrder(current => (current === 'asc' ? 'desc' : 'asc'))
    } else {
      // New field, default to descending (higher values first)
      setSortBy(field)
      setSortOrder('desc')
    }
  }, [sortBy])

  const setSort = useCallback((newSortBy: T, newSortOrder: SortOrder) => {
    setSortBy(newSortBy)
    setSortOrder(newSortOrder)
  }, [])

  return {
    sortBy,
    sortOrder,
    handleSort,
    setSort,
  }
}