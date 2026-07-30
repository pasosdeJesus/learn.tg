function debugLog(msg: string, data?: any) {
  if (typeof window === 'undefined') return
  if (data !== undefined) {
    console.log(`[AdminFetch] ${msg}`, data)
  } else {
    console.log(`[AdminFetch] ${msg}`)
  }
}

export function adminAuthParams(): string {
  if (typeof window === 'undefined') return ''
  const addr = localStorage.getItem('learn.tg.sessionAddress') || ''
  const tok = localStorage.getItem('learn.tg.authToken') || ''
  return `wallet=${encodeURIComponent(addr)}&token=${encodeURIComponent(tok)}`
}

export async function adminFetch<T = any>(url: string, init?: RequestInit): Promise<T> {
  const params = adminAuthParams()
  const addr = typeof window !== 'undefined' ? (localStorage.getItem('learn.tg.sessionAddress') || '') : ''
  const tok = typeof window !== 'undefined' ? (localStorage.getItem('learn.tg.authToken') || '') : ''

  if (!tok) {
    const msg = 'Auth token missing from localStorage. Please reconnect your wallet.'
    debugLog(msg, { addr: addr.slice(0, 10) + '...' })
    throw new Error(msg)
  }

  debugLog(`Fetching ${init?.method || 'GET'} ${url}`, {
    addr: addr.slice(0, 10) + '...',
    token: tok.slice(0, 8) + '...',
    tokenLen: tok.length,
  })

  const sep = url.includes('?') ? '&' : '?'
  const res = await fetch(`${url}${sep}${params}`, init)

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    const msg = err.error || `HTTP ${res.status}`
    debugLog(`FAILED ${res.status}: ${url}`, {
      status: res.status,
      error: msg,
      addr: addr.slice(0, 10) + '...',
      token: tok.slice(0, 8) + '...',
    })
    if (res.status === 401 || res.status === 403) {
      throw new Error(`Auth error (${res.status}). Try reconnecting your wallet.`)
    }
    throw new Error(msg)
  }
  return res.json()
}
