export function adminAuthParams(): string {
  if (typeof window === 'undefined') return ''
  const addr = localStorage.getItem('learn.tg.sessionAddress') || ''
  const tok = localStorage.getItem('learn.tg.authToken') || ''
  return `wallet=${encodeURIComponent(addr)}&token=${encodeURIComponent(tok)}`
}

export async function adminFetch<T = any>(url: string, init?: RequestInit): Promise<T> {
  const sep = url.includes('?') ? '&' : '?'
  const res = await fetch(`${url}${sep}${adminAuthParams()}`, init)
  return res.json()
}
