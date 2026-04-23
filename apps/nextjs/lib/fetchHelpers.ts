import type { Session } from 'next-auth'

/**
 * Helper to build URLSearchParams with wallet and token from session if available
 */
export function buildParamsWithSession(
  session: Session | null,
  baseParams?: Record<string, string>
): URLSearchParams {
  const params = new URLSearchParams()

  // Add base params
  if (baseParams) {
    for (const [key, value] of Object.entries(baseParams)) {
      params.append(key, value)
    }
  }

  // Add wallet and token from session if available
  if (session?.address) {
    params.append('wallet', session.address)
    const token = (session as any).user?.token || (session as any).token
    if (token) {
      params.append('token', token)
    }
  }

  return params
}

/**
 * Helper to create a fetch function with session handling
 */
export function createFetchFunction<T>(
  endpoint: string,
  buildParams?: (session: Session | null) => Record<string, string>
) {
  return async (session: Session | null): Promise<T> => {
    const params = buildParamsWithSession(
      session,
      buildParams ? buildParams(session) : undefined
    )

    const response = await fetch(`/api/${endpoint}?${params.toString()}`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return response.json()
  }
}