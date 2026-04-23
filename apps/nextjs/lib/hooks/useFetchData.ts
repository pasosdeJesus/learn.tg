import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'

interface UseFetchDataOptions<T> {
  initialData?: T
  fetchFunction: (session: any, params?: Record<string, any>) => Promise<T>
  params?: Record<string, any>
  autoFetch?: boolean
}

export function useFetchData<T>({
  initialData,
  fetchFunction,
  params = {},
  autoFetch = true,
}: UseFetchDataOptions<T>) {
  const { data: session } = useSession()
  const [data, setData] = useState<T | undefined>(initialData)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Use refs to avoid unstable references causing infinite re-render loops
  const fetchFunctionRef = useRef(fetchFunction)
  fetchFunctionRef.current = fetchFunction
  const paramsRef = useRef(params)
  paramsRef.current = params

  const fetchData = useCallback(async (customParams?: Record<string, any>) => {
    setIsLoading(true)
    setError(null)
    try {
      const mergedParams = { ...paramsRef.current, ...customParams }
      const result = await fetchFunctionRef.current(session, mergedParams)
      setData(result)
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      console.error('Failed to fetch data:', error)
      // Keep existing data on error
    } finally {
      setIsLoading(false)
    }
  }, [session])

  // Initial fetch if no initialData provided and autoFetch is true
  useEffect(() => {
    if (!initialData && autoFetch) {
      fetchData()
    }
  }, [])

  return {
    data,
    isLoading,
    error,
    fetchData,
    setData,
  }
}