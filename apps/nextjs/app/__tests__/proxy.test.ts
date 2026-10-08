import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { proxy } from '../../proxy'

// R-#247 (doc/csp.md §7.5): the CSP must not disappear silently. A future edit to
// `proxy.ts` (or a move to `next.config.ts`) that drops the header must fail here
// instead of shipping unprotected.

function run(path: string, method = 'GET', headers: Record<string, string> = {}) {
  const req = new NextRequest(`https://learn.tg${path}`, { method, headers })
  return proxy(req)
}

describe('proxy CSP (R-#247)', () => {
  it('serves an enforcing Content-Security-Policy on a page', () => {
    const csp = run('/en').headers.get('content-security-policy')
    expect(csp).toBeTruthy()
    expect(csp).toContain("default-src 'self'")
    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/)
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain('report-uri /api/csp-report')
  })

  it('serves the enforcing header, not only Report-Only', () => {
    const res = run('/en')
    expect(res.headers.get('content-security-policy')).toBeTruthy()
    expect(res.headers.get('content-security-policy-report-only')).toBeNull()
  })

  it('includes the sources the app relies on', () => {
    const csp = run('/en').headers.get('content-security-policy') || ''
    expect(csp).toContain("img-src 'self' data: blob: https:") // arbitrary NFT hosts
    expect(csp).toContain('https://www.youtube.com') // frame-src
    expect(csp).toContain('https://forno.celo.org') // connect-src
    expect(csp).toContain('https://goodserver.gooddollar.org')
    expect(csp).toContain('https://celo.blockscout.com')
  })

  it('generates a fresh nonce per request', () => {
    const a = run('/en').headers.get('content-security-policy')
    const b = run('/en').headers.get('content-security-policy')
    expect(a).not.toEqual(b)
  })

  it('keeps the CSRF guard for cross-site unsafe methods (R-#227)', () => {
    const res = run('/api/profile', 'POST', { 'sec-fetch-site': 'cross-site' })
    expect(res.status).toBe(403)
  })
})
