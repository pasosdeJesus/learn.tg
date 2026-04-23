import { useFetchData } from './useFetchData'
import { buildParamsWithSession } from '../fetchHelpers'

interface UseApiDataOptions<T> {
  endpoint: string
  params?: Record<string, string>
  initialData?: T
  autoFetch?: boolean
}

export function useApiData<T>({
  endpoint,
  params = {},
  initialData,
  autoFetch = true,
}: UseApiDataOptions<T>) {
  const fetchFunction = async (session: any, mergedParams?: Record<string, any>) => {
    // mergedParams includes both the hook's params and any custom params passed to fetchData
    const finalParams = { ...params, ...mergedParams }
    const searchParams = buildParamsWithSession(session, finalParams)
    const response = await fetch(`/api/${endpoint}?${searchParams.toString()}`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return response.json()
  }

  return useFetchData<T>({
    initialData,
    fetchFunction,
    params,
    autoFetch,
  })
}